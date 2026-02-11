"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getHandLandmarker } from "@/lib/vision/handLandmarker";
import { getPoseLandmarker } from "@/lib/vision/poseLandmarker";
import { FeatureProcessor } from "@/lib/features/featureEngineering";
import { SignClassifier } from "@/lib/model/inference";
import { saveSample, exportDataset, clearDatabase } from "@/lib/storage/datasetStore";
import { HandLandmarkerResult, PoseLandmarkerResult } from "@mediapipe/tasks-vision";
import { HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import { SignLanguageSelector } from "@/components/SignLanguageSelector";
import { SIGN_LANGUAGES, DEFAULT_LANGUAGE, SignLanguageKey } from "@/lib/signLanguages";
import { useSearchParams } from "next/navigation";

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
                const loaded = await classifier.load(currentConfig.modelDir);
                if (loaded) {
                    classifierRef.current = classifier;
                    setIsClassifierReady(true);
                    console.log("Classifier loaded");
                    setStatus(`Models ready (${currentConfig.name}).`);
                } else {
                    console.log("Classifier not found (train model first)");
                    setStatus(`Vision ready. Classifier not found for ${currentConfig.name}.`);
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
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                    throw new Error("Camera API not supported (check HTTPS/localhost)");
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


    const [trainingLogs, setTrainingLogs] = useState<string[]>([]);
    const [isTraining, setIsTraining] = useState(false);
    const searchParams = useSearchParams();
    const currentLang = (searchParams.get("lang") as SignLanguageKey) || DEFAULT_LANGUAGE;
    const currentConfig = SIGN_LANGUAGES[currentLang] || SIGN_LANGUAGES[DEFAULT_LANGUAGE];

    const handleTrain = async () => {
        setIsTraining(true);
        setTrainingLogs(["Starting training...", `Language: ${currentConfig.name}`]);

        try {
            const res = await fetch("/api/train", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lang: currentLang })
            });

            if (!res.ok) throw new Error("Failed to start training");
            if (!res.body) throw new Error("No response body");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value);
                setTrainingLogs(prev => [...prev, ...text.split("\n").filter(Boolean)]);
            }

            setTrainingLogs(prev => [...prev, "Done! Reload to use new model."]);
        } catch (e: any) {
            setTrainingLogs(prev => [...prev, `Error: ${e.message}`]);
        } finally {
            setIsTraining(false);
        }
    };

    return (
        <div className="p-4 max-w-6xl mx-auto font-sans">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">SignMeUp Debug</h1>
                <div className="flex gap-4 items-center">
                    <span className="text-sm font-medium text-slate-600">Active Language:</span>
                    <SignLanguageSelector />
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column: Camera */}
                <div className="space-y-6">
                    <div className="relative border-2 border-slate-200 bg-black aspect-[4/3] rounded-lg overflow-hidden shadow-md">
                        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-60" autoPlay playsInline muted />
                        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" width={640} height={480} />

                        {prediction && (
                            <div className="absolute top-4 left-4 bg-black/70 text-white px-4 py-2 rounded text-xl font-bold backdrop-blur-sm">
                                {prediction.label} <span className="text-sm font-normal text-gray-300">({(prediction.prob * 100).toFixed(0)}%)</span>
                            </div>
                        )}

                        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                            Model: {currentConfig.name}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={toggleCamera}
                            disabled={!modelLoaded}
                            className={`w-full px-4 py-3 font-semibold rounded-lg disabled:opacity-50 transition-colors shadow-sm ${isCameraRunning
                                ? "bg-red-100 text-red-700 hover:bg-red-200"
                                : "bg-blue-600 hover:bg-blue-700 text-white"
                                }`}
                        >
                            {isCameraRunning ? "Stop Camera" : (modelLoaded ? "Start Camera" : "Loading Models...")}
                        </button>
                        <div className="p-4 border rounded-lg bg-white shadow-sm flex flex-col justify-center">
                            <p className="text-sm text-slate-500 mb-1">System Status</p>
                            <p className="font-semibold text-blue-600 truncate">{status}</p>
                        </div>
                    </div>
                </div>

                {/* Right Column: Controls & Training */}
                <div className="space-y-6">

                    {/* Collection Panel */}
                    <div className="p-6 border rounded-xl bg-white shadow-sm space-y-4">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
                            Data Collection
                        </h2>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Label Name</label>
                            <input
                                type="text"
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                                placeholder="e.g. Hello, Thank You"
                                className="w-full border-gray-300 rounded-md shadow-sm border p-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>

                        <div className="flex gap-6">
                            <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
                                <input type="radio" name="type" className="w-4 h-4 text-blue-600" checked={recordType === "LETTER"} onChange={() => setRecordType("LETTER")} />
                                <span>Letter</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded">
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
                                {isRecording ? "Recording..." : "Start Record"}
                            </button>
                            <button
                                onClick={stopRecordingSafe}
                                disabled={!isRecording}
                                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg disabled:opacity-50 shadow transition-colors"
                            >
                                Stop & Save
                            </button>
                        </div>

                        <div className="flex gap-3 text-sm">
                            <button onClick={handleExport} className="flex-1 py-2 border hover:bg-slate-50 rounded text-slate-700 font-medium">
                                Export JSON
                            </button>
                            <button onClick={handleClear} className="flex-1 py-2 border hover:bg-red-50 text-red-600 rounded font-medium">
                                Clear Local Data
                            </button>
                        </div>
                    </div>

                    {/* Training Panel */}
                    <div className="p-6 border rounded-xl bg-slate-50 shadow-inner space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="w-2 h-8 bg-green-500 rounded-full"></span>
                                Training
                            </h2>
                            <span className="text-xs font-mono bg-slate-200 px-2 py-1 rounded">
                                Target: {currentConfig.fsModelDir}
                            </span>
                        </div>

                        <p className="text-sm text-slate-600">
                            Train a new model for <b>{currentConfig.name}</b> using: <br />
                            <code className="text-xs bg-slate-200 px-1 rounded">{currentConfig.dataset.path}</code>
                        </p>

                        <button
                            onClick={handleTrain}
                            disabled={isTraining}
                            className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:opacity-50 shadow-sm transition-all text-lg"
                        >
                            {isTraining ? "Training in progress..." : "Train Model Now"}
                        </button>

                        {/* Logs Terminal */}
                        <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-3 rounded-lg h-48 overflow-y-auto whitespace-pre-wrap shadow-inner">
                            {trainingLogs.length === 0 ? <span className="text-slate-500">// Logs will appear here...</span> : trainingLogs.join("\n")}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
