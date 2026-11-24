/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * Fields shared by the public forms under `/forms` (kit check, jacket): big tap targets for
 * phones, with the error shown under the field.
 */

/** A single-choice row of chips, e.g. Yes/No or a template's variants. */
export function ChoiceChips({
    label,
    options,
    value,
    onChange,
    error,
}: {
    label: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    error?: string;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{label}</span>
            <ToggleGroup
                type="single"
                variant="outline"
                value={value}
                onValueChange={onChange}
                aria-label={label}
                aria-invalid={error ? true : undefined}
                className={cn("flex-wrap", error && "rounded-lg ring-2 ring-destructive/60")}
            >
                {options.map((option) => (
                    <ToggleGroupItem key={option.value} value={option.value} className="px-3">
                        {option.label}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
            {error && <span className="text-sm text-destructive-foreground">{error}</span>}
        </div>
    );
}

/** A labelled one-line text input. */
export function TextField({
    id,
    label,
    value,
    onChange,
    placeholder,
    error,
    className,
    maxLength,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    error?: string;
    className?: string;
    /** Match the server's limit, so a long answer is stopped here rather than refused. */
    maxLength?: number;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                aria-invalid={error ? true : undefined}
                className={className}
                maxLength={maxLength}
            />
            {error && <span className="text-sm text-destructive-foreground">{error}</span>}
        </div>
    );
}
