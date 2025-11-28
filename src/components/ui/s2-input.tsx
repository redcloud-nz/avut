/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function S2_Input({
    className,
    type,
    ...props
}: ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                "w-full min-w-0 h-9 px-3 py-1", // Sizing and padding
                "border border-input rounded-md outline-none", // Border and shape
                "bg-transparent shadow-xs transition-[color,box-shadow] dark:bg-input/30", // Colors
                "text-base md:text-sm", // Text size
                "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium", // File input styles
                "placeholder:text-muted-foreground ", // Placeholder styles
                "selection:bg-primary selection:text-primary-foreground", // Text selection styles
                "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 ", // Disabled state
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]", // Focus state
                "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive", // Invalid state
                className,
            )}
            {...props}
        />
    );
}
