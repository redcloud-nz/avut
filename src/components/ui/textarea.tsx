/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ComponentProps } from "react";
import { tv, VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

const textareaVariants = tv({
    base: cn(
        "flex min-h-[80px] w-full bg-background text-sm ring-offset-background placeholder:text-muted-foreground",
        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
    ),
    variants: {
        variant: {
            default: "border border-input",
            ghost: "",
        },
        size: {
            default: "px-4 py-2.5 rounded-md",
            sm: "px-3 py-1.5 rounded-sm",
        },
    },
    defaultVariants: {
        variant: "default",
        size: "default",
    },
});

/**
 * Textarea component with Tailwind CSS styles.
 * @param className Additional class names to apply.
 * @param size Size variant of the textarea.
 * @param variant Style variant of the textarea.
 * @param props Other props to pass to the textarea element.
 */
export function Textarea({
    className,
    size,
    variant,
    ...props
}: ComponentProps<"textarea"> & VariantProps<typeof textareaVariants>) {
    return (
        <textarea
            className={textareaVariants({ className, size, variant })}
            data-component="Textarea"
            {...props}
        />
    );
}
