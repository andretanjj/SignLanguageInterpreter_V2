import { HandLandmarkerResult, PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { KEYPOINT_PROFILES, KeypointProfileName } from "./keypointProfiles";

// Configuration defaults
export const FEATURE_CONFIG = {
    windowFrames: 8,       // Number of frames per window (~0.25s at 30fps, 0.5s at 15fps)
    strideFrames: 4,       // Overlap stride
    windowsPerSample: 5,   // LSTM input length
    featuresPerKeypoint: 6 // (mean x,y,z) + (std x,y,z) = 6 values
};

export class FeatureProcessor {
    private frameBuffer: number[][] = [];
    private windowBuffer: number[][] = [];
    private config: typeof FEATURE_CONFIG;

    constructor(config = FEATURE_CONFIG) {
        this.config = config;
    }

    // Returns array of window features if a new window is ready, else null
    processFrame(pose: PoseLandmarkerResult, hands: HandLandmarkerResult): number[] | null {
        // 1. Extract Raw Features (Frame Level)
        const rawFeatures = this.extractRawFeatures(pose, hands);
        this.frameBuffer.push(rawFeatures);

        // 2. Check if we have enough frames for a window
        if (this.frameBuffer.length >= this.config.windowFrames) {
            // 3. Compute Window Stats
            const windowFeatures = this.computeWindowStats(this.frameBuffer);

            // 4. Slide Buffer
            // Remove 'stride' frames from the beginning
            // Actually, we want to keep features consistent.
            // If stride is 2, and we have 8 frames. 
            // Next window should start at index 2.
            // So we remove 'stride' frames.
            // BUT, we only emit 1 window per call? 
            // If we just pushed 1 frame, and size == 8, we emit window.
            // Then we should remove 'stride' frames? 
            // If stride < windowFrames, we have overlap.
            // Wait, if stride=4, window=8.
            // Frame 0..7 -> Window 0.
            // Next window starts at 4, ends at 11.
            // So we need to wait for 4 more frames.

            // Logic:
            // We keep a buffer. When length == windowFrames, we compute window.
            // Then we remove 'stride' frames. 
            // This means we won't emit another window until 'stride' frames are added.
            // Correct.
            this.frameBuffer.splice(0, this.config.strideFrames);

            return windowFeatures;
        }

        return null;
    }

    reset() {
        this.frameBuffer = [];
        this.windowBuffer = [];
    }

    private extractRawFeatures(pose: PoseLandmarkerResult, hands: HandLandmarkerResult): number[] {
        const profile = KEYPOINT_PROFILES.repo_default;
        const features: number[] = [];

        // POSE
        const poseLandmarks = pose.landmarks[0] || []; // 0 if no pose
        for (const idx of profile.pose) {
            const lm = poseLandmarks[idx];
            if (lm) {
                features.push(lm.x, lm.y, lm.z);
            } else {
                features.push(0, 0, 0);
            }
        }

        // HANDS
        // Identify Left vs Right
        let leftHand = null;
        let rightHand = null;

        if (hands.landmarks && hands.handedness) {
            for (let i = 0; i < hands.handedness.length; i++) {
                const label = hands.handedness[i][0].categoryName;
                // MediaPipe: "Left" means left hand (appears on left in selfie mode?? No usually 'Left' is Left Hand).
                // We'll trust the label.
                if (label === "Left") leftHand = hands.landmarks[i];
                if (label === "Right") rightHand = hands.landmarks[i];
            }
        }

        // Left Hand
        for (const idx of profile.hands) {
            const lm = leftHand ? leftHand[idx] : null;
            if (lm) {
                features.push(lm.x, lm.y, lm.z);
            } else {
                features.push(0, 0, 0);
            }
        }

        // Right Hand
        for (const idx of profile.hands) {
            const lm = rightHand ? rightHand[idx] : null;
            if (lm) {
                features.push(lm.x, lm.y, lm.z);
            } else {
                features.push(0, 0, 0);
            }
        }

        // Total: 6 pose + 5 left + 5 right = 16 points * 3 = 48 values
        return features;
    }

    private computeWindowStats(frames: number[][]): number[] {
        // frames is array of [48]
        const numFrames = frames.length;
        const numFeatures = frames[0].length;
        const result: number[] = [];

        for (let i = 0; i < numFeatures; i++) {
            let sum = 0;
            for (let j = 0; j < numFrames; j++) {
                sum += frames[j][i];
            }
            const mean = sum / numFrames;

            let sumSqDiff = 0;
            for (let j = 0; j < numFrames; j++) {
                const diff = frames[j][i] - mean;
                sumSqDiff += diff * diff;
            }
            const std = Math.sqrt(sumSqDiff / numFrames);

            result.push(mean, std);
        }

        // Result length: 48 * 2 = 96
        return result;
    }
}
