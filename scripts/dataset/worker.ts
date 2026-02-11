
import { parentPort, workerData } from 'worker_threads';
import { normalizeRecord, processDataset } from './normalizeDataset';
import { DatasetRecord, TrainingSample } from './types';

// workerData could contain config if needed, e.g. window size
// But for now we use defaults or passed messages.

if (parentPort) {
    parentPort.on('message', (message: { type: string, data: any[] }) => {
        if (message.type === 'process_batch') {
            try {
                const rawRecords: DatasetRecord[] = [];

                // data is an array of strings (lines) or objects
                for (const item of message.data) {
                    if (typeof item === 'string') {
                        if (!item.trim()) continue;
                        try {
                            const parsed = JSON.parse(item);
                            // We might need to attach source if passed, but typically 
                            // source is embedded or handled upstream. 
                            // If passed as string line, it might not have source unless injected.
                            // Actually, let's assume the loader injects source into the object BEFORE stringifying? 
                            // Or we parse here and add it?
                            // Better: expect objects (if already parsed) or strings.
                            // If string, we can't easily add source unless it's in the string.
                            // Let's assume the loader sends objects for now or handles source.
                            rawRecords.push(parsed);
                        } catch (e) {
                            // ignore bad lines
                        }
                    } else {
                        rawRecords.push(item);
                    }
                }

                const samples = processDataset(rawRecords);

                // Send back
                parentPort?.postMessage({ type: 'result', samples: samples });
                // Wait, processDataset logs to console? 
                // Worker console.log goes to main stdout usually.

                parentPort?.postMessage({ type: 'batch_done', count: samples.length });

            } catch (err) {
                console.error("Worker error:", err);
                parentPort?.postMessage({ type: 'error', error: err });
            }
        } else if (message.type === 'terminate') {
            process.exit(0);
        }
    });
}
