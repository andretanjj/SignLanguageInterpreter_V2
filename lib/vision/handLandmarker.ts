import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let handLandmarker: HandLandmarker | null = null;

export const getHandLandmarker = async () => {
    if (handLandmarker) {
        return handLandmarker;
    }

    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );

        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "/models/hand_landmarker.task",
                delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });

        console.log("HandLandmarker initialized");
        return handLandmarker;
    } catch (error) {
        console.error("Error initializing HandLandmarker:", error);
        throw error;
    }
};
