"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, RefreshCw, Trash2 } from "lucide-react"
import Link from "next/link"

export default function SettingsPage() {
    // Accessibility State (Persisted in localStorage in real app)
    const [highContrast, setHighContrast] = useState(false)
    const [largeText, setLargeText] = useState(false)
    const [reduceMotion, setReduceMotion] = useState(false)
    const [soundCues, setSoundCues] = useState(true)
    const [oneHanded, setOneHanded] = useState(false)

    // Scanning
    const [scanningEnabled, setScanningEnabled] = useState(false)
    const [scanSpeed, setScanSpeed] = useState(1.5)

    // TTS
    const [voice, setVoice] = useState("default")
    const [rate, setRate] = useState(1.0)
    const [volume, setVolume] = useState(1.0)

    useEffect(() => {
        // Apply classes to body for global styles
        document.body.classList.toggle("high-contrast", highContrast)
        document.body.classList.toggle("large-text", largeText)
        document.body.classList.toggle("reduce-motion", reduceMotion)
    }, [highContrast, largeText, reduceMotion])

    const handleReset = () => {
        if (confirm("Reset all settings to default?")) {
            setHighContrast(false)
            setLargeText(false)
            setReduceMotion(false)
            setSoundCues(true)
            setOneHanded(false)
            setScanningEnabled(false)
            setScanSpeed(1.5)
            setRate(1.0)
            setVolume(1.0)
            setVoice("default")
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6 font-sans pb-24">
            <header className="mb-8 flex items-center gap-4">
                <Link href="/interpreter">
                    <Button variant="ghost" size="icon">
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                </Link>
                <h1 className="text-2xl font-bold">Settings</h1>
            </header>

            <div className="max-w-2xl mx-auto space-y-8">
                {/* Accessibility Preferences */}
                <Card>
                    <CardHeader>
                        <CardTitle>Accessibility Preferences</CardTitle>
                        <CardDescription>Customize the interface to your needs.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">High Contrast</Label>
                                <p className="text-sm text-slate-500">Increase contrast for better visibility.</p>
                            </div>
                            <Switch checked={highContrast} onCheckedChange={setHighContrast} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Large Text</Label>
                                <p className="text-sm text-slate-500">Increase text size across the app.</p>
                            </div>
                            <Switch checked={largeText} onCheckedChange={setLargeText} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Reduce Motion</Label>
                                <p className="text-sm text-slate-500">Minimize animations and transitions.</p>
                            </div>
                            <Switch checked={reduceMotion} onCheckedChange={setReduceMotion} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Sound Cues</Label>
                                <p className="text-sm text-slate-500">Play sounds for actions and notifications.</p>
                            </div>
                            <Switch checked={soundCues} onCheckedChange={setSoundCues} />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">One-Handed Mode</Label>
                                <p className="text-sm text-slate-500">Cluster controls for easier reach.</p>
                            </div>
                            <Switch checked={oneHanded} onCheckedChange={setOneHanded} />
                        </div>
                    </CardContent>
                </Card>

                {/* Scanning & Switch Control */}
                <Card>
                    <CardHeader>
                        <CardTitle>Scanning & Switch Control</CardTitle>
                        <CardDescription>Configure switch access options.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-base">Enable Scanning</Label>
                                <p className="text-sm text-slate-500">Use row-column scanning for input.</p>
                            </div>
                            <Switch checked={scanningEnabled} onCheckedChange={setScanningEnabled} />
                        </div>

                        {scanningEnabled && (
                            <div className="space-y-4 pt-4 border-t">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <Label>Scan Speed</Label>
                                        <span className="text-sm font-bold text-blue-600">{scanSpeed.toFixed(1)}s</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Button variant="outline" size="icon" onClick={() => setScanSpeed(Math.max(0.5, scanSpeed - 0.1))}>-</Button>
                                        <Slider value={[scanSpeed]} min={0.5} max={3.0} step={0.1} onValueChange={(v) => setScanSpeed(v[0])} className="flex-1" />
                                        <Button variant="outline" size="icon" onClick={() => setScanSpeed(Math.min(3.0, scanSpeed + 0.1))}>+</Button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Scan Mode</Label>
                                    <Select defaultValue="row-col">
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select mode" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="row-col">Row-Column</SelectItem>
                                            <SelectItem value="linear">Linear</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Text-to-Speech */}
                <Card>
                    <CardHeader>
                        <CardTitle>Text-to-Speech</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label>Voice</Label>
                            <Select value={voice} onValueChange={setVoice}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select voice" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">Default (System)</SelectItem>
                                    <SelectItem value="female">Female (English US)</SelectItem>
                                    <SelectItem value="male">Male (English UK)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <Label>Speaking Rate</Label>
                                <span className="text-sm text-slate-500">{rate.toFixed(1)}x</span>
                            </div>
                            <Slider value={[rate]} min={0.5} max={2.0} step={0.1} onValueChange={(v) => setRate(v[0])} />
                        </div>
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <Label>Volume</Label>
                                <span className="text-sm text-slate-500">{(volume * 100).toFixed(0)}%</span>
                            </div>
                            <Slider value={[volume]} min={0} max={1} step={0.1} onValueChange={(v) => setVolume(v[0])} />
                        </div>
                    </CardContent>
                </Card>

                <Button variant="destructive" className="w-full h-14 text-lg" onClick={handleReset}>
                    <RefreshCw className="w-5 h-5 mr-2" /> Reset All to Defaults
                </Button>
            </div>
        </div>
    )
}
