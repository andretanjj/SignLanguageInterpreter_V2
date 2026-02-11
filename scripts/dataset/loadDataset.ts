
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import zlib from 'zlib';
import { DatasetRecord } from './types';

/**
 * loads a single file based on extension
 */
async function loadFile(filePath: string): Promise<DatasetRecord[]> {
    const ext = path.extname(filePath).toLowerCase();
    const records: DatasetRecord[] = [];

    // Determine source label based on filename or path context
    let source: "local" | "wlasl" | "other" = "other";
    if (path.basename(filePath).includes("wlasl")) source = "wlasl";
    else if (path.basename(filePath).includes("dataset.json")) source = "local";

    console.log(`Loading ${filePath} ...`);

    if (ext === '.json') {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
            // Apply source tag
            return data.map((d: any) => ({ ...d, source }));
        } else {
            console.warn(`Warning: ${filePath} is not a JSON array.`);
            return [];
        }
    } else if (ext === '.jsonl' || filePath.endsWith('.jsonl.gz')) {
        let input: NodeJS.ReadableStream;

        if (filePath.endsWith('.gz')) {
            input = fs.createReadStream(filePath).pipe(zlib.createGunzip());
        } else {
            input = fs.createReadStream(filePath);
        }

        const rl = readline.createInterface({
            input: input,
            crlfDelay: Infinity
        });

        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                const record = JSON.parse(line);
                record.source = source;
                records.push(record);
            } catch (e) {
                console.error(`Error parsing line in ${filePath}:`, e);
            }
        }
        return records;
    } else {
        console.warn(`Unsupported file extension: ${ext}`);
        return [];
    }
}

/**
 * Loads multiple datasets and merges them.
 */
export async function loadDatasets(filePaths: string[]): Promise<DatasetRecord[]> {
    const allRecords: DatasetRecord[] = [];

    for (const fp of filePaths) {
        if (fs.existsSync(fp)) {
            const records = await loadFile(fp);
            console.log(`Loaded ${records.length} records from ${fp}`);
            allRecords.push(...records);
        } else {
            console.warn(`Dataset file not found: ${fp}`);
        }
    }

    return allRecords;
}
