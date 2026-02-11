import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let poseLandmarker: PoseLandmarker | null = null;

export const getPoseLandmarker = async () => {
    if (poseLandmarker) {
        return poseLandmarker;
    }

    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "/models/pose_landmarker_full.task",
                delegate: "GPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        console.log("PoseLandmarker initialized");
        return poseLandmarker;
    } catch (error) {
        console.error("Error initializing PoseLandmarker:", error);
        throw error;
    }
};
