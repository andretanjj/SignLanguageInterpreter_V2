"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle, Camera } from "lucide-react"

interface CameraSetupWizardProps {
    isOpen: boolean
    onClose: () => void
    onCameraAccess: () => void
    isCameraRunning: boolean
}

export function CameraSetupWizard({ isOpen, onClose, onCameraAccess, isCameraRunning }: CameraSetupWizardProps) {
    const [step, setStep] = useState(1)

    const handleNext = () => {
        if (step === 1) setStep(2)
        else onClose()
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-center">Camera Setup</DialogTitle>
                    <DialogDescription className="text-center">
                        Let's make sure everything is ready for sign recognition.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-6">
                    {step === 1 ? (
                        <div className="space-y-6">
                            <div className="flex justify-center">
                                <div className="w-32 h-32 bg-slate-100 rounded-full flex items-center justify-center border-4 border-dashed border-slate-300">
                                    <div className="text-slate-400 text-center text-xs">
                                        [Illustration: User centered]
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 bg-green-50 p-4 rounded-lg border border-green-100">
                                    <CheckCircle className="text-green-600 w-8 h-8" />
                                    <span className="text-lg font-medium text-green-900">Good lighting</span>
                                </div>
                                <div className="flex items-center gap-4 bg-green-50 p-4 rounded-lg border border-green-100">
                                    <CheckCircle className="text-green-600 w-8 h-8" />
                                    <span className="text-lg font-medium text-green-900">Clear background</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 text-center">
                            <div className="aspect-video bg-black rounded-lg overflow-hidden relative flex items-center justify-center">
                                {isCameraRunning ? (
                                    <span className="text-white font-bold">Camera Active</span>
                                    // In a real app, we might show a preview here, but the main page handles the video stream usually.
                                    // For now, we assume the main page will show it or we need a way to preview it here.
                                    // Since the hook manages one video ref, we can't easily duplicate it here without complex stream handling.
                                    // We'll just trust the access is granted.
                                ) : (
                                    <Button onClick={onCameraAccess} size="lg" className="gap-2">
                                        <Camera className="w-6 h-6" />
                                        Allow Camera Access
                                    </Button>
                                )}
                            </div>
                            <p className="text-muted-foreground">
                                Ensure your upper body and hands are visible in the frame.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col sm:flex-col gap-2">
                    <Button onClick={handleNext} className="w-full h-14 text-xl" size="xl">
                        {step === 1 ? "Check Preview" : "I'm Ready"}
                    </Button>
                    {step === 1 && (
                        <Button variant="ghost" onClick={onClose} className="w-full">
                            Skip
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
