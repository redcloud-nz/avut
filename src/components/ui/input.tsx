/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps } from "react";
import { unique } from "remeda";
import { tv, VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

const inputVariants = tv({
    base: cn(
        "flex w-full min-w-0 bg-background text-sm align-middle transition-[color,box-shadow] outline-none",
        "dark:bg-input/30",
        "file:text-foreground file:inline-flex file:h-7 file:border-0 file:bg-background file:text-sm file:font-medium",
        "selection:bg-primary selection:text-primary-foreground",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
    ),
    variants: {
        variant: {
            default: "shadow-xs border border-input",
            ghost: "",
        },
        size: {
            default: "h-10 px-4 py-2.5 rounded-md",
            sm: "h-8 px-3 py-1.5 rounded-sm",
        },
    },
    defaultVariants: {
        variant: "default",
        size: "default",
    },
});

/**
 * Input component with Tailwind CSS styles.
 * @param className Additional class names to apply.
 * @param size Size variant of the input.
 * @param type Type of the input (e.g., text, password).
 * @param variant Style variant of the input.
 * @param props Other props to pass to the input element.
 */
export function Input({
    className,
    size,
    type,
    variant,
    ...props
}: Omit<ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>) {
    return (
        <input
            type={type}
            className={inputVariants({ className, size, variant })}
            data-component="Input"
            {...props}
        />
    );
}

export function HiddenInput({
    name,
    value,
}: Omit<ComponentProps<"input">, "type">) {
    return <input type="hidden" name={name} value={value} />;
}

/**
 * ConstrainedInputProps defines the props for input components constrained to specific value types.
 */
type ConstrainedInputProps<TValue> = Omit<
    ComponentProps<"input">,
    "defaultValue" | "onChange" | "size" | "type" | "value"
> &
    VariantProps<typeof inputVariants> & {
        onValueChange?: (value: TValue) => void;
        value?: TValue;
    };

/**
 * TextInput component for text input with Tailwind CSS styles.
 * @param className Additional class names to apply.
 * @param onValueChange Callback when the value changes.
 * @param size Size variant of the input.
 * @param value Current value of the input.
 * @param variant Style variant of the input.
 * @param props Other props to pass to the input element.
 */
export function TextInput({
    className,
    onValueChange,
    size,
    value = "",
    variant,
    ...props
}: ConstrainedInputProps<string>) {
    function handleChange(ev: React.ChangeEvent<HTMLInputElement>) {
        onValueChange?.(ev.target.value);
    }

    return (
        <input
            type="text"
            className={cn(inputVariants({ className, size, variant }))}
            data-component="TextInput"
            {...props}
            value={value}
            onChange={handleChange}
        />
    );
}

export function SlugInput({
    className,
    maxLength = 20,
    onValueChange,
    size,
    value = "",
    variant,
    ...props
}: ConstrainedInputProps<string>) {
    function handleChange(ev: React.ChangeEvent<HTMLInputElement>) {
        const newValue = ev.target.value.replace(/[^a-zA-Z0-9-]/g, "");
        onValueChange?.(newValue);
    }

    return (
        <input
            type="text"
            className={cn(inputVariants({ className, size, variant }))}
            maxLength={maxLength}
            data-component="SlugInput"
            value={value}
            onChange={handleChange}
            {...props}
        />
    );
}

export function TagsInput({
    className,
    onValueChange,
    size,
    value = [],
    variant,
    ...props
}: ConstrainedInputProps<string[]>) {
    if (!Array.isArray(value))
        throw new Error("TagsInput value must be an array of strings");

    function handleChange(ev: React.ChangeEvent<HTMLInputElement>) {
        const newValue = unique(
            ev.target.value.split(" ").map((tag) => tag.toLowerCase()),
        );
        onValueChange?.(newValue);
    }

    return (
        <input
            type="text"
            className={cn(inputVariants({ className, size, variant }))}
            data-component="TagsInput"
            value={value?.join(" ")}
            onChange={handleChange}
            {...props}
        />
    );
}
