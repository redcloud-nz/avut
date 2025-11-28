/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { CircleIcon } from "lucide-react";
import { ComponentProps } from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export function RadioGroup({
    className,
    ...props
}: ComponentProps<typeof RadioGroupPrimitive.Root>) {
    return (
        <RadioGroupPrimitive.Root
            data-component="RadioGroup"
            data-slot="radio-group"
            className={cn("grid gap-3", className)}
            {...props}
        />
    );
}
export function RadioGroupItem({
    className,
    ...props
}: ComponentProps<typeof RadioGroupPrimitive.Item>) {
    return (
        <RadioGroupPrimitive.Item
            data-component="RadioGroupItem"
            data-slot="radio-group-item"
            className={cn(
                "border-input text-primary dark:bg-input/30 aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[color,box-shadow] outline-none",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",

                "disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            {...props}
        >
            <RadioGroupPrimitive.Indicator
                data-slot="radio-group-indicator"
                className="relative flex items-center justify-center"
            >
                <CircleIcon className="fill-primary absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2" />
            </RadioGroupPrimitive.Indicator>
        </RadioGroupPrimitive.Item>
    );
}
