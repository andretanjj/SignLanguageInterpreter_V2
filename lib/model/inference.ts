import * as tf from '@tensorflow/tfjs';
import { FEATURE_CONFIG } from '@/lib/features/featureEngineering';

export interface PredictionResult {
    label: string;
    probability: number;
}

export class SignClassifier {
    private model: tf.LayersModel | null = null;
    private labels: string[] = [];
    private scaler: { mean: number[], std: number[] } | null = null;

    // Smoothing state
    private lastPredictions: string[] = [];
    private smoothingWindow = 5;

    async load(modelDir: string = '/models/signmeup') {
        try {
            // Load Model
            this.model = await tf.loadLayersModel(`${modelDir}/model.json`);

            // Load Labels
            const labelsReq = await fetch(`${modelDir}/labels.json`);
            this.labels = await labelsReq.json();

            // Load Scaler
            const scalerReq = await fetch(`${modelDir}/scaler.json`);
            this.scaler = await scalerReq.json();

            console.log(`Model loaded from ${modelDir}`);
            return true;
        } catch (e) {
            console.error(`Failed to load model from ${modelDir}:`, e);
            return false;
        }
    }

    predict(windowFeatures: number[][]): PredictionResult[] {
        if (!this.model || !this.scaler || windowFeatures.length < FEATURE_CONFIG.windowsPerSample) {
            return [];
        }

        // 1. Get last N windows
        const inputWindows = windowFeatures.slice(-FEATURE_CONFIG.windowsPerSample);

        // 2. Standardize
        const xData = inputWindows.map(window =>
            window.map((val, i) => (val - this.scaler!.mean[i]) / this.scaler!.std[i])
        );

        // 3. Tensor
        const inputTensor = tf.tensor([xData]); // Shape [1, 5, 96]

        // 4. Predict
        const prediction = this.model.predict(inputTensor) as tf.Tensor;
        const info = prediction.dataSync(); // Float32Array of probabilities

        inputTensor.dispose();
        prediction.dispose();

        // 5. Map to labels
        const results: PredictionResult[] = Array.from(info)
            .map((prob, i) => ({ label: this.labels[i], probability: prob }))
            .sort((a, b) => b.probability - a.probability);

        // 6. Smoothing (Optional in this method, or separate)
        // For now, return raw top-3
        return results.slice(0, 3);
    }

    // Helper to get committed label
    getSmoothedLabel(currentTopLabel: string): string | null {
        this.lastPredictions.push(currentTopLabel);
        if (this.lastPredictions.length > this.smoothingWindow) {
            this.lastPredictions.shift();
        }

        // Check consistency
        // If all in window are same, return it.
        const allSame = this.lastPredictions.every(l => l === currentTopLabel);
        return allSame ? currentTopLabel : null;
    }
}
