
import { DatasetRecord, TrainingSample } from './types';

const CONFIG = {
    featureDim: 96,
    windowsPerSample: 5,
    stride: 1
};

export function normalizeRecord(record: any): DatasetRecord | null {
    // Basic validation
    if (!record.label || !record.features || !Array.isArray(record.features)) {
        return null; // Invalid structure
    }

    // Check feature dimensions
    // We expect Array of Arrays.
    // If features is empty, skip
    if (record.features.length === 0) return null;

    // Optional: Validate inner dimension of first frame (fast check)
    if (record.features[0].length !== CONFIG.featureDim) {
        // Log once or restrict logging to avoid spam? 
        // For now, let's just return null if strictly invalid, 
        // OR we can try to fix if it's close? content says "drop unknown fields".
        // Let's be strict on dimension.
        return null;
    }

    return {
        id: record.id,
        label: record.label,
        type: record.type || "PHRASE",
        features: record.features,
        createdAt: record.createdAt,
        metadata: record.metadata,
        source: record.source
    };
}


/**
 * Converts a raw recording (variable length) into fixed-size training samples (sliding windows).
 */
export function processDataset(records: DatasetRecord[]): TrainingSample[] {
    const samples: TrainingSample[] = [];
    let skippedShort = 0;
    let skippedInvalid = 0;

    for (const raw of records) {
        const record = normalizeRecord(raw);
        if (!record) {
            skippedInvalid++;
            continue;
        }

        const feats = record.features;

        // If shorter than window size, skip
        if (feats.length < CONFIG.windowsPerSample) {
            skippedShort++;
            continue;
        }

        // Sliding window
        // For local data (user recordings), we might want more overlap (stride 1).
        // For WLASL (huge), stride 1 is fine too given streaming nature?
        // Let's use config stride.

        for (let i = 0; i <= feats.length - CONFIG.windowsPerSample; i += CONFIG.stride) {
            const window = feats.slice(i, i + CONFIG.windowsPerSample);
            samples.push({
                features: window,
                label: record.label,
                source: record.source
            });
        }
    }

    console.log(`Normalization Report:`);
    console.log(`- Total Inputs: ${records.length}`);
    console.log(`- Skipped (Invalid/Empty): ${skippedInvalid}`);
    console.log(`- Skipped (Too Short < ${CONFIG.windowsPerSample}): ${skippedShort}`);
    console.log(`- Generated Samples: ${samples.length}`);

    return samples;
}
