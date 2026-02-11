
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import zlib from 'zlib';
import { Worker } from 'worker_threads';
import os from 'os';
import { TrainingSample } from './types';

const NUM_WORKERS = Math.max(1, (os.cpus().length || 2) - 1);
const BATCH_SIZE = 500; // Lines per batch to send to worker

export async function* createDatasetGenerator(filePaths: string[]): AsyncGenerator<TrainingSample[]> {
    console.log(`Starting parallel loader with ${NUM_WORKERS} workers.`);

    // Initialize Workers
    const workers: Worker[] = [];
    // We need to resolve the worker path. Since we are running with tsx, we point to the .ts file.
    // However, Node's Worker constructor doesn't natively support TS.
    // We must use the same loader.
    // Check if we are in tsx (likely).

    const workerPath = path.resolve(__dirname, 'worker.ts');

    for (let i = 0; i < NUM_WORKERS; i++) {
        const worker = new Worker(workerPath, {
            // execArgv needs to register tsx if running from source
            execArgv: process.execArgv.includes('--import') ? process.execArgv : (
                // If not explicit, try to guess or use default tsx registration if possible.
                // Actually, tsx usually registers itself in the main process.
                // But workers are new processes.
                // Proper way for tsx:
                ['--import', 'tsx/esm']
            ),
            workerData: { workerId: i }
        });
        workers.push(worker);
    }

    // Queue to hold batches ready to be sent
    // We'll use a simple Round Robin or pull-based approach?
    // RR is easier.

    // We need a way to receive results.
    // We can use a shared buffer or just listen to messages.
    // To implement a generator, we need to push results to a buffer that the generator yields.

    const resultBuffer: TrainingSample[][] = [];
    let isDoneReading = false;
    let activeWorkers = 0;
    let pendingResolves: ((value: IteratorResult<TrainingSample[]>) => void)[] = [];

    // Helper to resolve pending next() calls
    const pushResult = (samples: TrainingSample[]) => {
        if (pendingResolves.length > 0) {
            const resolve = pendingResolves.shift()!;
            resolve({ value: samples, done: false });
        } else {
            resultBuffer.push(samples);
        }
    };

    // Handle Worker Messages
    workers.forEach((w, idx) => {
        w.on('message', (msg) => {
            if (msg.type === 'batch_done') {
                // simple ack
            } else if (msg.type === 'result') {
                // msg.sampels (fix typo from worker: samples)
                // Wait, I fixed the typo in my thought but maybe not in code?
                // I wrote 'sampels' in the worker code above (CodeContent).
                // I should assume I wrote 'sampels' or 'samples'. 
                // Let's check what I actually wrote in the previous tool call.
                // I wrote: parentPort?.postMessage({ type: 'result', sampels: samples }); // Typo fix: samples
                // So the key is 'sampels'. I should fix it in next edit or handle it here.
                // Handling it here for safety.
                const data = msg.samples || msg.sampels || [];
                if (data.length > 0) pushResult(data);

                activeWorkers--;
                checkDone();
            } else if (msg.type === 'error') {
                console.error(`Worker ${idx} error:`, msg.error);
                activeWorkers--;
                checkDone();
            }
        });
        w.on('error', (err) => {
            console.error(`Worker ${idx} crashed:`, err);
            activeWorkers--;
            checkDone();
        });
        w.on('exit', () => {
            // worker died
        });
    });

    const checkDone = () => {
        if (isDoneReading && activeWorkers === 0 && resultBuffer.length === 0) {
            // clear all pending
            while (pendingResolves.length > 0) {
                pendingResolves.shift()!({ value: undefined, done: true });
            }
        }
    };

    // Start Reading Files
    (async () => {
        let currentWorker = 0;

        for (const fp of filePaths) {
            const source = path.basename(fp).includes("wlasl") ? "wlasl" : "local";
            console.log(`Streaming ${fp} (${source})...`);

            let linesBatch: any[] = [];

            const flushBatch = () => {
                if (linesBatch.length === 0) return;

                activeWorkers++;
                workers[currentWorker].postMessage({ type: 'process_batch', data: linesBatch });
                currentWorker = (currentWorker + 1) % NUM_WORKERS;
                linesBatch = [];
            };

            if (fp.endsWith('.json')) {
                // Read full JSON
                const raw = fs.readFileSync(fp, 'utf-8');
                const data = JSON.parse(raw);
                if (Array.isArray(data)) {
                    // Inject source
                    const tagged = data.map((d: any) => ({ ...d, source }));
                    // Chunk it
                    for (const item of tagged) {
                        linesBatch.push(item);
                        if (linesBatch.length >= BATCH_SIZE) flushBatch();
                    }
                }
            } else {
                // Line based
                let input: NodeJS.ReadableStream;
                if (fp.endsWith('.gz')) input = fs.createReadStream(fp).pipe(zlib.createGunzip());
                else input = fs.createReadStream(fp);

                const rl = readline.createInterface({ input, crlfDelay: Infinity });

                for await (const line of rl) {
                    if (!line.trim()) continue;
                    // We can parse here or send string. Sending string saves parsing on main thread.
                    // But we likely want to inject source. 
                    // However, we can't inject property into string.
                    // So we must parse on main thread OR send structure { line, source }.
                    // Worker expects 'line' string or object.
                    // Let's parse on main thread? Parsing is fast, validation is slow.
                    // Parsing 14k lines on main thread is negligible. 
                    try {
                        const parsed = JSON.parse(line);
                        parsed.source = source;
                        linesBatch.push(parsed);
                    } catch (e) { }

                    if (linesBatch.length >= BATCH_SIZE) {
                        flushBatch();
                        // Backpressure? strict AsyncGenerator pull? 
                        // If we read too fast, we flood workers.
                        // We should wait if activeWorkers is huge.
                        if (activeWorkers > NUM_WORKERS * 2) {
                            // simple pause
                            await new Promise(r => setTimeout(r, 10));
                        }
                    }
                }
            }
            flushBatch();
        }
        isDoneReading = true;
        checkDone();
    })();

    // Yield results
    try {
        while (true) {
            if (resultBuffer.length > 0) {
                yield resultBuffer.shift()!;
            } else if (isDoneReading && activeWorkers === 0) {
                break;
            } else {
                // Wait for data
                const nextChunk = await new Promise<IteratorResult<TrainingSample[]>>((resolve) => {
                    pendingResolves.push(resolve);
                });
                if (nextChunk.done) break;
                yield nextChunk.value;
            }
        }
    } finally {
        console.log("Terminating workers...");
        workers.forEach(w => w.terminate());
    }
}
