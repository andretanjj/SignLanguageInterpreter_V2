"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getHandLandmarker } from "@/lib/vision/handLandmarker";
import { getPoseLandmarker } from "@/lib/vision/poseLandmarker";
import { FeatureProcessor } from "@/lib/features/featureEngineering";
import { SignClassifier } from "@/lib/model/inference";
import { saveSample, exportDataset, clearDatabase } from "@/lib/storage/datasetStore";
import { HandLandmarkerResult, PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import { SIGN_LANGUAGES, DEFAULT_LANGUAGE, SignLanguageKey } from "@/lib/signLanguages";
import { useSearchParams } from "next/navigation";

export function useInterpreterController() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isCameraRunning, setIsCameraRunning] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [status, setStatus] = useState("Initializing...");
    const [isOverlayEnabled, setIsOverlayEnabled] = useState(true);

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [recordCount, setRecordCount] = useState(0);

    // Inference State
    const [prediction, setPrediction] = useState<{ label: string; prob: number } | null>(null);
    const [isClassifierReady, setIsClassifierReady] = useState(false);

    // Logic Refs
    const isRecordingRef = useRef(false);
    const recordingBufferRef = useRef<number[][]>([]);
    const inferenceBufferRef = useRef<number[][]>([]);

    const handLandmarkerRef = useRef<HandLandmarker | null>(null);
    const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
    const featureProcessorRef = useRef<FeatureProcessor | null>(null);
    const classifierRef = useRef<SignClassifier | null>(null);
    const requestRef = useRef<number>(0);

    const searchParams = useSearchParams();
    const currentLang = (searchParams.get("lang") as SignLanguageKey) || DEFAULT_LANGUAGE;
    const currentConfig = SIGN_LANGUAGES[currentLang] || SIGN_LANGUAGES[DEFAULT_LANGUAGE];

    useEffect(() => {
        async function load() {
            try {
                setStatus(`Loading ${currentConfig.name} models...`);
                // Only load vision models if not already loaded (optimization)
                if (!handLandmarkerRef.current) {
                    const [hand, pose] = await Promise.all([
                        getHandLandmarker(),
                        getPoseLandmarker(),
                    ]);
                    handLandmarkerRef.current = hand;
                    poseLandmarkerRef.current = pose;
                    featureProcessorRef.current = new FeatureProcessor();
                }

                // Load Classifier (Always reload on lang change)
                setIsClassifierReady(false);
                const classifier = new SignClassifier();
                const loaded = await classifier.load(currentConfig.modelDir);
                if (loaded) {
                    classifierRef.current = classifier;
                    setIsClassifierReady(true);
                    console.log(`Classifier loaded: ${currentConfig.name}`);
                    setStatus(`Ready (${currentConfig.name})`);
                } else {
                    console.log("Classifier not found (train model first)");
                    setStatus(`Vision ready. No model for ${currentConfig.name}.`);
                    classifierRef.current = null;
                }

                setModelLoaded(true);
            } catch (e) {
                console.error(e);
                setStatus("Error loading models.");
            }
        }
        load();
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [currentLang]);

    const draw = (handResult: HandLandmarkerResult, poseResult: PoseLandmarkerResult) => {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx || !videoRef.current || !isOverlayEnabled) {
            if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            return;
        }

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        // Optional: Draw video frame to canvas if we want to process it there, but usually we just overlay on video element
        // ctx.drawImage(videoRef.current, 0, 0, ctx.canvas.width, ctx.canvas.height);

        // Draw Pose
        if (poseResult.landmarks) {
            ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
            for (const landmarks of poseResult.landmarks) {
                for (const lm of landmarks) {
                    ctx.beginPath();
                    ctx.arc(lm.x * ctx.canvas.width, lm.y * ctx.canvas.height, 4, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }

        // Draw Hands
        if (handResult.landmarks) {
            ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
            for (const landmarks of handResult.landmarks) {
                for (const lm of landmarks) {
                    ctx.beginPath();
                    ctx.arc(lm.x * ctx.canvas.width, lm.y * ctx.canvas.height, 4, 0, 2 * Math.PI);
                    ctx.fill();
                }
            }
        }
    };

    const predict = useCallback(() => {
        if (!videoRef.current || !handLandmarkerRef.current || !poseLandmarkerRef.current) return;

        if (videoRef.current.paused || videoRef.current.ended || !videoRef.current.videoWidth) {
            requestRef.current = requestAnimationFrame(predict);
            return;
        }

        const startTimeMs = performance.now();

        // Vision
        const handResult = handLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);
        const poseResult = poseLandmarkerRef.current.detectForVideo(videoRef.current, startTimeMs);

        draw(handResult, poseResult);

        // Feature Engineering
        if (featureProcessorRef.current) {
            const windowFeature = featureProcessorRef.current.processFrame(poseResult, handResult);

            if (windowFeature) {
                // Recording
                if (isRecordingRef.current) {
                    recordingBufferRef.current.push(windowFeature);
                    setRecordCount(recordingBufferRef.current.length); // Update count live
                }

                // Inference (Rolling Buffer)
                if (classifierRef.current) {
                    inferenceBufferRef.current.push(windowFeature);
                    if (inferenceBufferRef.current.length > 5) {
                        inferenceBufferRef.current.shift();
                    }

                    if (inferenceBufferRef.current.length === 5) {
                        const results = classifierRef.current.predict(inferenceBufferRef.current);
                        if (results.length > 0) {
                            const top = results[0];
                            if (top.probability > 0.6) {
                                const smoothed = classifierRef.current.getSmoothedLabel(top.label);
                                if (smoothed) {
                                    setPrediction({ label: smoothed, prob: top.probability });
                                }
                            }
                        }
                    }
                }
            }
        }

        requestRef.current = requestAnimationFrame(predict);
    }, [isOverlayEnabled]);

    const toggleCamera = async () => {
        if (isCameraRunning) {
            if (videoRef.current && videoRef.current.srcObject) {
                const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
                tracks.forEach((t) => t.stop());
                videoRef.current.srcObject = null;
            }
            setIsCameraRunning(false);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        } else {
            setStatus("Starting camera...");
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error("Camera API not supported in this browser");
                }
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480 },
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadeddata = () => {
                        setIsCameraRunning(true);
                        setStatus(isClassifierReady ? "Camera running (Inference Active)" : "Camera running (Recording Mode)");
                        predict();
                    }
                }
            } catch (e) {
                console.error(e);
                setStatus("Error accessing camera.");
            }
        }
    };

    const startRecording = (label: string) => {
        if (!label) return alert("Enter label");
        recordingBufferRef.current = [];
        if (featureProcessorRef.current) featureProcessorRef.current.reset();

        isRecordingRef.current = true;
        setIsRecording(true);
        setRecordCount(0);
        setStatus("Recording...");
    };

    const stopRecording = async (label: string, type: "LETTER" | "PHRASE") => {
        isRecordingRef.current = false;
        setIsRecording(false);

        const count = recordingBufferRef.current.length;
        setStatus(`Recorded ${count} windows.`);
        setRecordCount(count);

        if (count === 0) {
            setStatus("No data recorded");
            return;
        }

        try {
            await saveSample({
                label,
                type,
                features: [...recordingBufferRef.current],
            });
            setStatus(`Saved sample: ${label} (${count} windows)`);
        } catch (e) {
            console.error(e);
            setStatus("Error saving sample");
        }
    };

    const handleExport = async () => {
        const json = await exportDataset();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "dataset.json";
        a.click();
        setStatus("Dataset exported");
    };

    const handleClear = async () => {
        if (confirm("Are you sure you want to clear ALL recorded samples? This cannot be undone.")) {
            await clearDatabase();
            if (featureProcessorRef.current) featureProcessorRef.current.reset();
            setRecordCount(0);
            setStatus("Dataset cleared");
        }
    };

    const toggleOverlay = () => {
        setIsOverlayEnabled(!isOverlayEnabled);
    };

    return {
        videoRef,
        canvasRef,
        isCameraRunning,
        modelLoaded,
        status,
        isOverlayEnabled,
        toggleOverlay,
        toggleCamera,
        isRecording,
        recordCount,
        startRecording,
        stopRecording,
        prediction,
        isClassifierReady,
        handleExport,
        handleClear
    };
}
