"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Globe } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { SIGN_LANGUAGES, SignLanguageKey, DEFAULT_LANGUAGE } from "@/lib/signLanguages"
import { useRouter, useSearchParams } from "next/navigation"

interface SignLanguageSelectorProps {
    value?: SignLanguageKey
    onValueChange?: (value: SignLanguageKey) => void
    className?: string
}

export function SignLanguageSelector({ value, onValueChange, className }: SignLanguageSelectorProps) {
    const [open, setOpen] = React.useState(false)
    const router = useRouter()
    const searchParams = useSearchParams()

    // Internal state if not controlled matches URL or Default
    const [internalValue, setInternalValue] = React.useState<SignLanguageKey>(
        (searchParams.get("lang") as SignLanguageKey) || DEFAULT_LANGUAGE
    )

    const currentValue = value || internalValue;

    const handleSelect = (newValue: SignLanguageKey) => {
        setInternalValue(newValue)
        setOpen(false)
        if (onValueChange) onValueChange(newValue)

        // Update URL without full reload
        const params = new URLSearchParams(searchParams)
        params.set("lang", newValue)
        router.replace(`?${params.toString()}`)

        // Save to localStorage
        if (typeof window !== 'undefined') {
            localStorage.setItem("signmeup.language", newValue);
        }
    }

    // Sync validation
    const verifiedValue = SIGN_LANGUAGES[currentValue] ? currentValue : DEFAULT_LANGUAGE;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-[200px] justify-between", className)}
                >
                    <div className="flex items-center gap-2 truncate">
                        <Globe className="w-4 h-4 text-muted-foreground" />
                        {SIGN_LANGUAGES[verifiedValue].name}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
                <Command>
                    <CommandList>
                        <CommandGroup>
                            {Object.entries(SIGN_LANGUAGES).map(([key, config]) => (
                                <CommandItem
                                    key={key}
                                    value={key}
                                    onSelect={() => handleSelect(key as SignLanguageKey)}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            verifiedValue === key ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {config.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
