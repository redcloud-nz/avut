/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps } from "react";
import { tv, VariantProps } from "tailwind-variants";

const displayValueVariants = tv({
    base: "flex w-full border border-transparent text-sm align-middle ",
    variants: {
        loading: {
            true: "bg-slate-200 text-slate-500 flex items-center justify-center",
            false: "text-slate-900",
        },
        size: {
            default: "h-10 rounded-md px-4 py-2.5",
            sm: "h-8 rounded-md px-3 py-1.5",
        },
        variant: {
            default: "",
            paragraph: "min-h-[80px]",
        },
    },
    slots: {
        spinner:
            "animate-spin size-5 rounded-full border-t-1 border-b-1 border-gray-900",
    },
    defaultVariants: {
        loading: false,
        size: "default",
        variant: "default",
    },
});

export function DisplayValue({
    children,
    className,
    loading = false,
    size,
    variant,
    ...props
}: ComponentProps<"div"> & VariantProps<typeof displayValueVariants>) {
    const styles = displayValueVariants({ className, loading, size, variant });

    return (
        <div className={styles.base()} {...props}>
            {loading ? (
                <div className={styles.spinner()} />
            ) : (
                <span>{children}</span>
            )}
        </div>
    );
}
