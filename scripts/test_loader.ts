
import path from 'path';
import { loadDatasets } from './dataset/loadDataset';
import { processDataset } from './dataset/normalizeDataset';

async function main() {
    // Check args
    const files = process.argv.slice(2);
    if (files.length === 0) {
        console.log("Usage: npx tsx scripts/test_loader.ts <file1> <file2> ...");
        process.exit(1);
    }

    const absPaths = files.map(f => path.resolve(process.cwd(), f));

    console.log("Testing loader with:", absPaths);

    // 1. Load
    const rawRecords = await loadDatasets(absPaths);
    console.log(`\nLoaded ${rawRecords.length} total raw records.`);

    if (rawRecords.length > 0) {
        const sample = rawRecords[0];
        console.log("Sample Record 0:");
        console.log("- Label:", sample.label);
        console.log("- Source:", sample.source);
        console.log("- Feature Length:", sample.features.length);
        console.log("- Feature Dim:", sample.features[0]?.length);
    }

    // 2. Process
    console.log("\nProcessing/Normalizing...");
    const samples = processDataset(rawRecords);

    // Stats
    const labelCounts: Record<string, number> = {};
    samples.forEach(s => {
        labelCounts[s.label] = (labelCounts[s.label] || 0) + 1;
    });

    console.log("\nLabel Distribution (Top 10):");
    const sortedLabels = Object.entries(labelCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    sortedLabels.forEach(([lbl, count]) => {
        console.log(`- ${lbl}: ${count} samples`);
    });

}

main().catch(console.error);
