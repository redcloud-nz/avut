/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

import { ComponentProps } from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

export function Empty({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="empty"
            className={cn(
                "flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-none border-dashed p-6 text-center text-balance",
                className,
            )}
            {...props}
        />
    );
}

export function EmptyHeader({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="empty-header"
            className={cn(
                "flex max-w-sm flex-col items-center gap-2 text-center",
                className,
            )}
            {...props}
        />
    );
}

const emptyMediaVariants = tv({
    base: "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
    variants: {
        variant: {
            default: "bg-transparent",
            icon: "bg-muted text-foreground flex size-8 shrink-0 items-center justify-center rounded-none [&_svg:not([class*='size-'])]:size-4",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});

export function EmptyMedia({
    className,
    variant = "default",
    ...props
}: ComponentProps<"div"> & VariantProps<typeof emptyMediaVariants>) {
    return (
        <div
            data-slot="empty-icon"
            data-variant={variant}
            className={cn(emptyMediaVariants({ variant, className }))}
            {...props}
        />
    );
}

export function EmptyTitle({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="empty-title"
            className={cn("text-sm font-medium", className)}
            {...props}
        />
    );
}

export function EmptyDescription({ className, ...props }: ComponentProps<"p">) {
    return (
        <div
            data-slot="empty-description"
            className={cn(
                "text-muted-foreground [&>a:hover]:text-primary text-xs/relaxed [&>a]:underline [&>a]:underline-offset-4",
                className,
            )}
            {...props}
        />
    );
}

export function EmptyContent({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="empty-content"
            className={cn(
                "flex w-full max-w-sm min-w-0 flex-col items-center gap-2.5 text-xs text-balance",
                className,
            )}
            {...props}
        />
    );
}
