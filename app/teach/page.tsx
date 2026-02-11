"use client"

import React, { useState, useEffect } from "react"
import { useInterpreterController } from "@/lib/hooks/useInterpreterController"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
// import { Input } from "@/components/ui/input" // We need Input! I forgot to create it. I'll use standard input or create it.
import { ArrowLeft, Mic, Save, RotateCcw, Check, Video } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

// Quick Input Component inline or I'll create it later if strict
function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <input
            className={`flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-lg ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
            {...props}
        />
    )
}

const STEPS = ["Name", "Record", "Review", "Save"]

export default function TeachPage() {
    const router = useRouter()
    const [currentStep, setCurrentStep] = useState(0)
    const [phraseName, setPhraseName] = useState("")

    const {
        videoRef,
        isCameraRunning,
        toggleCamera,
        isRecording,
        startRecording,
        stopRecording,
        recordCount,
        status
    } = useInterpreterController()

    // Step 1: Name
    // Step 2: Record
    // Step 3: Review (Simulated for now, usually we'd replay but we don't store video, just features. So maybe "Test"?)
    // Step 4: Save (Done)

    const handleNext = () => {
        if (currentStep === 0 && !phraseName) return
        if (currentStep < STEPS.length - 1) setCurrentStep(curr => curr + 1)
    }

    const handleBack = () => {
        if (currentStep > 0) setCurrentStep(curr => curr - 1)
        else router.push("/interpreter")
    }

    const handleStartRecording = async () => {
        if (!isCameraRunning) await toggleCamera()
        // Wait a bit?
        startRecording(phraseName)
    }

    const handleStopRecording = async () => {
        await stopRecording(phraseName, "PHRASE")
        handleNext() // Go to Review/Save
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans">
            <header className="mb-8 flex items-center gap-4">
                <Link href="/interpreter">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold">Teach New Phrase</h1>
            </header>

            <div className="max-w-2xl mx-auto space-y-8">
                {/* Stepper */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium text-slate-500">
                        {STEPS.map((step, i) => (
                            <span key={step} className={i <= currentStep ? "text-blue-600 font-bold" : ""}>
                                {i + 1}. {step}
                            </span>
                        ))}
                    </div>
                    <Progress value={(currentStep / (STEPS.length - 1)) * 100} className="h-2" />
                </div>

                <Card className="min-h-[400px] flex flex-col justify-center">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">{STEPS[currentStep]}</CardTitle>
                        <CardDescription>
                            {currentStep === 0 && "Give your new sign a name."}
                            {currentStep === 1 && "Perform the sign clearly in front of the camera."}
                            {currentStep === 2 && "Phrase recorded successfully."}
                            {currentStep === 3 && "Your phrase is ready to use!"}
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
                        {currentStep === 0 && (
                            <div className="w-full max-w-sm space-y-4">
                                <Label htmlFor="phraseName">Phrase Name</Label>
                                <Input
                                    id="phraseName"
                                    placeholder="e.g. 'Coffee', 'Where is the bathroom?'"
                                    value={phraseName}
                                    onChange={(e) => setPhraseName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        )}

                        {currentStep === 1 && (
                            <div className="w-full relative aspect-video bg-black rounded-lg overflow-hidden border-2 border-slate-200">
                                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay playsInline muted />
                                {!isCameraRunning && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Button onClick={toggleCamera}>Turn On Camera</Button>
                                    </div>
                                )}
                                {isRecording && (
                                    <div className="absolute top-4 right-4 animate-pulse bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold">
                                        Recording... {recordCount}
                                    </div>
                                )}
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="text-center space-y-4">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                                    <Check className="w-10 h-10" />
                                </div>
                                <p className="text-lg">Recorded <b>{recordCount}</b> frames for "{phraseName}".</p>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div className="text-center space-y-4">
                                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600">
                                    <Save className="w-10 h-10" />
                                </div>
                                <p className="text-lg">Saved to local device.</p>
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="flex justify-between p-6 bg-slate-50 border-t">
                        <Button variant="ghost" onClick={handleBack} disabled={isRecording}>
                            Back
                        </Button>

                        {currentStep === 0 && (
                            <Button onClick={handleNext} disabled={!phraseName} size="lg">Next</Button>
                        )}

                        {currentStep === 1 && (
                            isRecording ? (
                                <Button onClick={handleStopRecording} variant="destructive" size="xl" className="animate-pulse">
                                    Stop Recording
                                </Button>
                            ) : (
                                <Button onClick={handleStartRecording} size="xl" className="bg-red-600 hover:bg-red-700 text-white">
                                    <Mic className="w-6 h-6 mr-2" /> Start Recording
                                </Button>
                            )
                        )}

                        {currentStep === 2 && (
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                                    <RotateCcw className="w-4 h-4 mr-2" /> Redo
                                </Button>
                                <Button onClick={() => setCurrentStep(3)} size="lg">
                                    Save Phrase
                                </Button>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <Link href="/interpreter">
                                <Button size="lg" variant="default">Done</Button>
                            </Link>
                        )}
                    </CardFooter>
                </Card>
            </div>
        </div>
    )
}
