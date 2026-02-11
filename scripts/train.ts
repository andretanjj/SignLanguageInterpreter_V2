import * as tf from '@tensorflow/tfjs';
import fs from 'fs';
import path from 'path';
import { loadDatasets } from './dataset/loadDataset';
import { processDataset } from './dataset/normalizeDataset';

// Default datasets to look for
const DEFAULT_DATASETS = [
    'dataset.json',
    'wlasl_dataset.jsonl.gz'
];

const OUTPUT_DIR = path.resolve(__dirname, '../public/models/signmeup');

// Parse CLI args for --dataset
const args = process.argv.slice(2);
let datasetPaths: string[] = [];
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dataset' && args[i + 1]) {
        datasetPaths.push(args[i + 1]);
        i++;
    }
}

// If no args provided, look for defaults
if (datasetPaths.length === 0) {
    datasetPaths = DEFAULT_DATASETS.filter(f => fs.existsSync(path.resolve(__dirname, `../${f}`)));
    if (datasetPaths.length === 0) {
        console.error("No datasets found. Please provide --dataset <path> or ensure dataset.json or wlasl_dataset.jsonl.gz exist.");
        process.exit(1);
    }
}

// Resolve absolute paths
const ABS_DATASET_PATHS = datasetPaths.map(p => path.resolve(__dirname, p.startsWith('/') ? p : `../${p}`));

console.log(`Using datasets:`, ABS_DATASET_PATHS);

// Ensure output dir exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Configuration (must match frontend)
const CONFIG = {
    windowsPerSample: 5,
    featureDim: 96,
    epochs: 50,
    batchSize: 16
};

// Custom IO Handler to save model artifacts using fs
const nodeFileSystemRouter = (pathStr: string) => ({
    save: async (artifacts: tf.io.ModelArtifacts) => {
        // Save model.json
        const modelJsonPath = path.join(pathStr, 'model.json');
        fs.writeFileSync(modelJsonPath, JSON.stringify(artifacts, null, 2));

        // Save weights if present
        if (artifacts.weightData) {
            const weightFile = 'group1-shard1of1.bin';
            const weightPath = path.join(pathStr, weightFile);
            fs.writeFileSync(weightPath, Buffer.from(artifacts.weightData as ArrayBuffer));

            const manifest = [{
                paths: [weightFile],
                weights: artifacts.weightSpecs
            }];

            const modelArtifacts = {
                modelTopology: artifacts.modelTopology,
                format: artifacts.format,
                generatedBy: artifacts.generatedBy,
                convertedBy: artifacts.convertedBy,
                weightsManifest: manifest
            };

            fs.writeFileSync(modelJsonPath, JSON.stringify(modelArtifacts, null, 2));
        }

        return {
            modelArtifactsInfo: {
                dateSaved: new Date(),
                modelTopologyType: 'JSON' as const,
            },
        };
    }
});

function computeScaler(featuresList: number[][][]) {
    // featuresList is [N, 5, 96]
    // We want to flatten everything to compute mean/std per feature dimension (96)

    const numFeatures = CONFIG.featureDim;
    let count = 0;
    const sum = new Array(numFeatures).fill(0);
    const sumSq = new Array(numFeatures).fill(0);

    for (const sample of featuresList) {
        for (const frame of sample) {
            for (let i = 0; i < numFeatures; i++) {
                const val = frame[i];
                sum[i] += val;
                sumSq[i] += val * val;
            }
            count++;
        }
    }

    const mean = sum.map(s => s / count);
    const std = sumSq.map((sq, i) => {
        const variance = (sq / count) - (mean[i] * mean[i]);
        return Math.sqrt(Math.max(0, variance)) || 1.0; // Avoid zero std
    });

    return { mean, std };
}

async function train() {
    console.log('Loading datasets...');
    const rawRecords = await loadDatasets(ABS_DATASET_PATHS);
    console.log(`Loaded ${rawRecords.length} raw records.`);

    if (rawRecords.length === 0) {
        console.error("Dataset is empty.");
        process.exit(1);
    }

    console.log('Normalizing and creating training batches...');
    const samples = processDataset(rawRecords); // Returns { features: number[][], label }
    console.log(`Generated ${samples.length} valid training samples.`);

    if (samples.length === 0) {
        console.error("No valid samples generated. Check your data.");
        process.exit(1);
    }

    // Prepare data for scaler
    const allFeatures = samples.map(s => s.features);

    console.log('Computing scaler...');
    const scaler = computeScaler(allFeatures);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'scaler.json'), JSON.stringify(scaler));

    console.log('Standardizing data...');
    const X: number[][][] = [];
    const y: string[] = [];

    samples.forEach(sample => {
        const standardized = sample.features.map(frame =>
            frame.map((val, i) => (val - scaler.mean[i]) / scaler.std[i])
        );
        X.push(standardized);
        y.push(sample.label);
    });

    // Encode labels
    const uniqueLabels = Array.from(new Set(y)).sort();
    if (uniqueLabels.length < 2) {
        console.error(`\nError: Dataset only contains ${uniqueLabels.length} class(es): ${uniqueLabels.join(", ")}.`);
        process.exit(1);
    }

    const labelMap = new Map(uniqueLabels.map((l, i) => [l, i]));
    fs.writeFileSync(path.join(OUTPUT_DIR, 'labels.json'), JSON.stringify(uniqueLabels));

    const ys = y.map(l => labelMap.get(l)!);

    // Convert to Tensors
    const xsTensor = tf.tensor3d(X, [X.length, CONFIG.windowsPerSample, CONFIG.featureDim]);
    const ysTensor = tf.oneHot(tf.tensor1d(ys, 'int32'), uniqueLabels.length);

    // Build Model
    const model = tf.sequential();
    model.add(tf.layers.lstm({
        units: 64,
        inputShape: [CONFIG.windowsPerSample, CONFIG.featureDim],
        returnSequences: false
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
    model.add(tf.layers.dense({ units: uniqueLabels.length, activation: 'softmax' }));

    model.compile({
        optimizer: 'adam',
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });

    console.log('Training...');
    await model.fit(xsTensor, ysTensor, {
        epochs: CONFIG.epochs,
        batchSize: CONFIG.batchSize,
        validationSplit: 0.2,
        callbacks: {
            onEpochEnd: (epoch, logs) => {
                console.log(`Epoch ${epoch + 1}: loss=${logs?.loss.toFixed(4)}, acc=${logs?.acc.toFixed(4)}`);
            }
        }
    });

    console.log('Saving model...');
    // Use custom saver
    await model.save(nodeFileSystemRouter(OUTPUT_DIR) as tf.io.IOHandler);
    console.log(`Model saved to ${OUTPUT_DIR}`);
}

train().catch(console.error);
