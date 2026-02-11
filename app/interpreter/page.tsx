"use client"

import React, { useState, useEffect } from "react"
import { useInterpreterController } from "@/lib/hooks/useInterpreterController"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { CameraSetupWizard } from "@/components/CameraSetupWizard"
import { ScanningKeyboard } from "@/components/ScanningKeyboard"
import { Camera, RefreshCw, Volume2, Mic, Settings, LayoutGrid, Eye, EyeOff, Save, Trash2, StopCircle, PlayCircle } from "lucide-react"

export default function InterpreterPage() {
    const {
        videoRef,
        canvasRef,
        isCameraRunning,
        modelLoaded,
        status,
        isOverlayEnabled,
        toggleOverlay,
        toggleCamera,
        prediction,
        isClassifierReady,
        handleExport
    } = useInterpreterController()

    const [committedText, setCommittedText] = useState("")
    const [isSetupOpen, setIsSetupOpen] = useState(false)
    const [isScanningOpen, setIsScanningOpen] = useState(false)
    const [quickSettingsOpen, setQuickSettingsOpen] = useState(false)

    // TTS Settings
    const [volume, setVolume] = useState(1.0)
    const [rate, setRate] = useState(1.0)

    const handleSpeak = () => {
        if (!committedText) return
        const utterance = new SpeechSynthesisUtterance(committedText)
        utterance.volume = volume
        utterance.rate = rate
        window.speechSynthesis.speak(utterance)
    }

    const handlePredictionCommit = () => {
        if (prediction?.label) {
            setCommittedText((prev) => prev + prediction.label)
        }
    }

    // Auto-commit for demo purposes or via button in real app
    // We'll let the user commit via keyboard or a big "Commit" button if we had one
    // But for now, let's just show the prediction and let them type or use the scanning keyboard.

    // Actually, in the design "Letters" tab showed predictions.
    // We can have a button to "Add" the prediction.

    return (
        <div className="min-h-screen bg-slate-50 p-4 font-sans text-slate-900">
            {/* Header */}
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-blue-900 tracking-tight">SignMeUp</h1>
                    <p className="text-slate-600 font-medium">Assistive Interpreter</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="icon" onClick={() => setQuickSettingsOpen(!quickSettingsOpen)}>
                        <Settings className="w-6 h-6" />
                    </Button>
                </div>
            </header>

            {/* Status Bar */}
            <div className="flex gap-2 mb-6 flex-wrap">
                <Badge variant={isCameraRunning ? "default" : "destructive"} className="text-sm py-1 px-3">
                    {isCameraRunning ? "Camera Active" : "Camera Off"}
                </Badge>
                <Badge variant={modelLoaded ? "secondary" : "outline"} className="text-sm py-1 px-3 border-2">
                    {modelLoaded ? "Model Ready" : "Loading Model..."}
                </Badge>
                <Badge variant="outline" className="text-sm py-1 px-3 border-2 border-slate-300">
                    Offline Ready
                </Badge>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-24">
                {/* Left Card: Input */}
                <Card className="overflow-hidden border-2 border-slate-200 shadow-sm">
                    <CardHeader className="bg-slate-100/50 pb-4">
                        <CardTitle className="text-xl flex justify-between items-center">
                            Video Input
                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={toggleOverlay}>
                                    {isOverlayEnabled ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
                                    {isOverlayEnabled ? "Hide Skeleton" : "Show Skeleton"}
                                </Button>
                            </div>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 relative aspect-[4/3] bg-black">
                        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-60" autoPlay playsInline muted />
                        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" width={640} height={480} />

                        {!isCameraRunning && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm z-10">
                                <Button size="xl" onClick={toggleCamera} className="gap-2 text-xl py-6 rounded-full shadow-xl animate-bounce-slow">
                                    <PlayCircle className="w-8 h-8" />
                                    Start Camera
                                </Button>
                            </div>
                        )}

                        <div className="absolute bottom-4 right-4 z-20 flex gap-2">
                            <Button size="icon" variant="secondary" onClick={() => setIsSetupOpen(true)} title="Recalibrate">
                                <RefreshCw className="w-5 h-5" />
                            </Button>
                        </div>
                    </CardContent>
                    <div className="p-4 bg-white border-t flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-500">
                            {status}
                        </span>
                        {isCameraRunning && (
                            <Button variant="destructive" size="default" onClick={toggleCamera}>
                                <StopCircle className="w-4 h-4 mr-2" /> Stop
                            </Button>
                        )}
                    </div>
                </Card>

                {/* Right Card: Output */}
                <Card className="border-2 border-slate-200 shadow-sm flex flex-col h-[600px] lg:h-auto">
                    <Tabs defaultValue="letters" className="flex-1 flex flex-col">
                        <CardHeader className="pb-2">
                            <TabsList className="grid w-full grid-cols-2 h-14 p-1">
                                <TabsTrigger value="letters" className="text-lg h-full">Letters & Typing</TabsTrigger>
                                <TabsTrigger value="phrases" className="text-lg h-full">Phrases</TabsTrigger>
                            </TabsList>
                        </CardHeader>

                        <CardContent className="flex-1 p-4 flex flex-col gap-4">
                            <TabsContent value="letters" className="flex-1 flex flex-col gap-4 mt-0">
                                {/* Live Prediction */}
                                <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-6 text-center shadow-inner">
                                    <h3 className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-1">Live Prediction</h3>
                                    <div className="text-6xl font-black text-blue-900 h-20 flex items-center justify-center">
                                        {prediction?.label || <span className="text-slate-300">-</span>}
                                        {prediction && <span className="text-lg font-medium text-blue-400 ml-2">{(prediction.prob * 100).toFixed(0)}%</span>}
                                    </div>
                                    <div className="mt-4 flex justify-center gap-2">
                                        <Button onClick={handlePredictionCommit} disabled={!prediction} size="lg" className="px-8">
                                            Append "{prediction?.label}"
                                        </Button>
                                    </div>
                                </div>

                                {/* Committed Text */}
                                <div className="flex-1 bg-slate-100 rounded-xl p-4 border border-slate-200 relative">
                                    <textarea
                                        className="w-full h-full bg-transparent border-none resize-none text-2xl font-medium focus:ring-0 p-2"
                                        value={committedText}
                                        onChange={(e) => setCommittedText(e.target.value)}
                                        placeholder="Typed text will appear here..."
                                    />
                                    <div className="absolute bottom-4 right-4 flex gap-2">
                                        <Button size="icon" variant="ghost" onClick={() => setCommittedText("")} title="Clear">
                                            <Trash2 className="w-5 h-5" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="grid grid-cols-2 gap-4">
                                    <Button size="xl" className="h-16 text-lg" onClick={handleSpeak}>
                                        <Volume2 className="w-6 h-6 mr-2" /> Speak
                                    </Button>
                                    <Button size="xl" variant="secondary" className="h-16 text-lg" onClick={() => setIsScanningOpen(!isScanningOpen)}>
                                        <LayoutGrid className="w-6 h-6 mr-2" /> Keyboard
                                    </Button>
                                </div>
                            </TabsContent>

                            <TabsContent value="phrases" className="flex-1 flex flex-col justify-center items-center text-center mt-0">
                                <div className="space-y-6">
                                    <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Save className="w-10 h-10 text-slate-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-700">Saved Phrases</h3>
                                    <p className="text-slate-500 max-w-xs mx-auto">
                                        Teach SignMeUp custom phrases to recognize them instantly.
                                    </p>
                                    <Button size="xl" className="w-full max-w-xs">
                                        Teach New Phrase
                                    </Button>
                                    <Button size="xl" variant="outline" className="w-full max-w-xs" onClick={handleExport}>
                                        <Save className="w-5 h-5 mr-2" /> Export Dataset (JSON)
                                    </Button>
                                </div>
                            </TabsContent>
                        </CardContent>
                    </Tabs>
                </Card>
            </div>

            {/* Quick Settings Drawer (Collapsible) */}
            {quickSettingsOpen && (
                <div className="fixed inset-x-0 bottom-0 bg-white border-t-2 border-slate-200 p-6 shadow-2xl z-40 pb-24 animate-in slide-in-from-bottom">
                    <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h3 className="font-bold text-lg mb-4">Text-to-Speech</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>Volume</Label>
                                    <Slider value={[volume * 100]} max={100} onValueChange={(v) => setVolume(v[0] / 100)} className="w-1/2" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label>Rate</Label>
                                    <Slider value={[rate * 10]} min={5} max={20} onValueChange={(v) => setRate(v[0] / 10)} className="w-1/2" />
                                </div>
                            </div>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg mb-4">Accessibility</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <Label>High Contrast</Label>
                                    <Switch />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label>Large Text</Label>
                                    <Switch />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Overlays */}
            <CameraSetupWizard
                isOpen={isSetupOpen}
                onClose={() => setIsSetupOpen(false)}
                onCameraAccess={toggleCamera}
                isCameraRunning={isCameraRunning}
            />

            <ScanningKeyboard
                isOpen={isScanningOpen}
                onClose={() => setIsScanningOpen(false)}
                onSelect={(key) => setCommittedText(curr => curr + key)}
                suggestions={["HELLO", "THANK YOU", "YES", "NO"]}
            />
        </div>
    )
}
