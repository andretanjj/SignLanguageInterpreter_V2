"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, Delete, Space, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

const KEYBOARD_LAYOUT = [
    ["A", "B", "C", "D", "E", "F"],
    ["G", "H", "I", "J", "K", "L"],
    ["M", "N", "O", "P", "Q", "R"],
    ["S", "T", "U", "V", "W", "X"],
    ["Y", "Z", "SPACE", "BACKSPACE", "ENTER"]
]

interface ScanningKeyboardProps {
    onSelect: (key: string) => void
    suggestions?: string[]
    isOpen: boolean
    onClose: () => void
}

export function ScanningKeyboard({ onSelect, suggestions = [], isOpen, onClose }: ScanningKeyboardProps) {
    const [scanningEnabled, setScanningEnabled] = useState(false)
    const [scanSpeed, setScanSpeed] = useState(1500) // ms
    const [currentRow, setCurrentRow] = useState(0)
    const [currentCol, setCurrentCol] = useState(-1) // -1 means scanning rows
    const [activeRef, setActiveRef] = useState<HTMLElement | null>(null)

    const timerRef = useRef<NodeJS.Timeout | null>(null)

    // Handle Esc key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isOpen && e.key === "Escape") {
                onClose()
            }
        }
        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [isOpen, onClose])

    const handleScan = useCallback(() => {
        if (!scanningEnabled || !isOpen) return

        if (currentCol === -1) {
            // Row Scanning
            setCurrentRow((prev) => (prev + 1) % KEYBOARD_LAYOUT.length)
        } else {
            // Column Scanning
            const rowLength = KEYBOARD_LAYOUT[currentRow].length
            setCurrentCol((prev) => (prev + 1) % rowLength)
        }
    }, [scanningEnabled, isOpen, currentCol, currentRow])

    useEffect(() => {
        if (scanningEnabled && isOpen) {
            timerRef.current = setInterval(handleScan, scanSpeed)
        } else {
            if (timerRef.current) clearInterval(timerRef.current)
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [scanSpeed, scanningEnabled, isOpen, handleScan])

    // Reset state when closed
    useEffect(() => {
        if (!isOpen) {
            setScanningEnabled(false)
            setCurrentRow(0)
            setCurrentCol(-1)
        }
    }, [isOpen])

    const handleSwitchPress = () => {
        if (!scanningEnabled) {
            setScanningEnabled(true)
            return
        }

        if (currentCol === -1) {
            // Select Row -> Start Column Scanning
            setCurrentCol(0)
        } else {
            // Select Key
            const key = KEYBOARD_LAYOUT[currentRow][currentCol]
            onSelect(key === "SPACE" ? " " : key)
            // Reset to Row Scanning
            setCurrentCol(-1)
            setCurrentRow(0)
        }
    }

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Drawer */}
            <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t shadow-2xl animate-in slide-in-from-bottom duration-300">
                <div className="max-w-4xl mx-auto space-y-4 relative">
                    {/* Close Button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="absolute -top-2 -right-2 text-muted-foreground hover:text-foreground"
                        onClick={onClose}
                    >
                        Close (Esc)
                    </Button>

                    {/* Top Bar: Suggestions & Controls */}
                    <div className="flex justify-between items-center gap-4 mt-6">
                        <div className="flex gap-2 flex-1 overflow-x-auto">
                            {suggestions.map((word, i) => (
                                <Button key={i} variant="secondary" className="text-lg px-6 py-6" onClick={() => onSelect(word + " ")}>
                                    {word}
                                </Button>
                            ))}
                        </div>
                        <div className="flex items-center gap-4 bg-muted p-2 rounded-lg">
                            <span className="text-sm font-bold">Speed: {scanSpeed / 1000}s</span>
                            <Button size="icon" variant="ghost" onClick={() => setScanningEnabled(!scanningEnabled)}>
                                {scanningEnabled ? <Pause /> : <Play />}
                            </Button>
                            <Button
                                size="lg"
                                className="bg-primary text-primary-foreground h-16 px-8 text-xl font-bold border-4 border-transparent active:border-white transition-all"
                                onClick={handleSwitchPress}
                            >
                                SELECT (SWITCH)
                            </Button>
                        </div>
                    </div>

                    {/* Keyboard Grid */}
                    <div className="grid gap-2 p-2 bg-slate-900/5 rounded-xl border">
                        {KEYBOARD_LAYOUT.map((row, rowIndex) => (
                            <div
                                key={rowIndex}
                                className={cn(
                                    "grid grid-cols-6 gap-2 p-1 rounded transition-colors",
                                    currentCol === -1 && currentRow === rowIndex ? "bg-accent ring-2 ring-primary ring-offset-2" : ""
                                )}
                            >
                                {row.map((key, colIndex) => {
                                    const isActive = currentRow === rowIndex && currentCol === colIndex
                                    return (
                                        <Button
                                            key={colIndex}
                                            variant={isActive ? "default" : "outline"}
                                            className={cn(
                                                "h-14 text-lg font-bold transition-all",
                                                isActive ? "scale-105 ring-4 ring-primary ring-offset-2 z-10" : "",
                                                key.length > 1 ? "col-span-2" : "col-span-1"
                                            )}
                                            onClick={() => onSelect(key === "SPACE" ? " " : key)}
                                        >
                                            {key === "BACKSPACE" ? <Delete /> : key === "ENTER" ? <ArrowRight /> : key === "SPACE" ? "SPACE" : key}
                                        </Button>
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}
