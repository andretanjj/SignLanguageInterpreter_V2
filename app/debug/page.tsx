"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getHandLandmarker } from "@/lib/vision/handLandmarker";
import { getPoseLandmarker } from "@/lib/vision/poseLandmarker";
import { FeatureProcessor } from "@/lib/features/featureEngineering";
import { SignClassifier } from "@/lib/model/inference";
import { saveSample, exportDataset, clearDatabase } from "@/lib/storage/datasetStore";
import { HandLandmarkerResult, PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";

export default function DebugPage() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isCameraRunning, setIsCameraRunning] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [status, setStatus] = useState("Initializing...");

    // Recording State Sync
    const [isRecording, setIsRecording] = useState(false);
    const [recordCount, setRecordCount] = useState(0);

    const [label, setLabel] = useState("A");
    const [recordType, setRecordType] = useState<"LETTER" | "PHRASE">("LETTER");

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

    useEffect(() => {
        async function load() {
            try {
                setStatus("Loading vision models...");
                const [hand, pose] = await Promise.all([
                    getHandLandmarker(),
                    getPoseLandmarker(),
                ]);
                handLandmarkerRef.current = hand;
                poseLandmarkerRef.current = pose;
                featureProcessorRef.current = new FeatureProcessor();

                // Load Classifier
                const classifier = new SignClassifier();
                const loaded = await classifier.load();
                if (loaded) {
                    classifierRef.current = classifier;
                    setIsClassifierReady(true);
                    console.log("Classifier loaded");
                    setStatus("Models ready (Vision + Classifier).");
                } else {
                    console.log("Classifier not found (train model first)");
                    setStatus("Vision ready. Classifier not found (Record & Train).");
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
    }, []);

    const draw = (handResult: HandLandmarkerResult, poseResult: PoseLandmarkerResult) => {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx || !videoRef.current) return;

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.drawImage(videoRef.current, 0, 0, ctx.canvas.width, ctx.canvas.height);

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
    }, []);

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

    const startRecordingSafe = () => {
        if (!label) return alert("Enter label");
        recordingBufferRef.current = [];
        if (featureProcessorRef.current) featureProcessorRef.current.reset();

        isRecordingRef.current = true;
        setIsRecording(true);
        setRecordCount(0);
        setStatus("Recording...");
    };

    const stopRecordingSafe = async () => {
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
                type: recordType,
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


    return (
        <div className="p-4 max-w-4xl mx-auto font-sans">
            <h1 className="text-3xl font-bold mb-6">SignMeUp Debug</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="relative border-2 border-slate-200 bg-black aspect-[4/3] rounded-lg overflow-hidden">
                    <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-50" autoPlay playsInline muted />
                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" width={640} height={480} />

                    {prediction && (
                        <div className="absolute top-4 left-4 bg-black/70 text-white px-4 py-2 rounded text-xl font-bold">
                            {prediction.label} <span className="text-sm font-normal text-gray-300">({(prediction.prob * 100).toFixed(0)}%)</span>
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    <div className="p-4 border rounded-lg bg-slate-50">
                        <p className="mb-2">Status: <span className="font-semibold text-blue-600">{status}</span></p>
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-300'}`}></div>
                            <span className="font-medium">{isRecording ? "RECORDING" : "IDLE"}</span>
                        </div>
                        {isRecording && <p className="text-sm text-gray-500 mt-1">Windows captured: {recordCount} (updated on stop)</p>}

                        {isClassifierReady && (
                            <div className="mt-2 text-green-600 font-bold text-sm">
                                ✓ Model Loaded (Inference Active)
                            </div>
                        )}
                    </div>

                    <button
                        onClick={toggleCamera}
                        disabled={!modelLoaded}
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:opacity-50 transition-colors"
                    >
                        {isCameraRunning ? "Stop Camera" : (modelLoaded ? "Start Camera" : "Loading Models...")}
                    </button>

                    <div className="border p-6 rounded-lg space-y-4 shadow-sm">
                        <h2 className="text-xl font-bold">Data Collection</h2>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                            <input
                                type="text"
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                                placeholder="e.g. A, Hello"
                                className="w-full border-gray-300 rounded-md shadow-sm border p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div className="flex gap-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="type" className="w-4 h-4 text-blue-600" checked={recordType === "LETTER"} onChange={() => setRecordType("LETTER")} />
                                <span>Letter</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="type" className="w-4 h-4 text-blue-600" checked={recordType === "PHRASE"} onChange={() => setRecordType("PHRASE")} />
                                <span>Phrase</span>
                            </label>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={startRecordingSafe}
                                disabled={!isCameraRunning || isRecording}
                                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg disabled:opacity-50 shadow transition-colors"
                            >
                                Start Record
                            </button>
                            <button
                                onClick={stopRecordingSafe}
                                disabled={!isRecording}
                                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg disabled:opacity-50 shadow transition-colors"
                            >
                                Stop & Save
                            </button>
                        </div>

                        <hr className="my-4" />

                        <div className="flex gap-3">
                            <button onClick={handleExport} className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors">
                                Export JSON
                            </button>
                            <button onClick={handleClear} className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition-colors">
                                Clear Data
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
