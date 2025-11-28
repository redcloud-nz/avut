/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ComponentProps } from "react";

import { Slot as SlotPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

import { Skeleton } from "./skeleton";

export function StatItem({
    asChild = false,
    className,
    ...props
}: ComponentProps<"div"> & { asChild?: boolean }) {
    const Comp = asChild ? SlotPrimitive.Slot : "div";

    return (
        <Comp
            data-slot="stat-item"
            className={cn(
                "group/item w-48 h-32 flex flex-col items-center justify-center flex-wrap gap-2 p-3",
                "border border-border rounded-md outline-none",
                "text-sm transition-colors",
                "[a]:hover:bg-accent/50 [a]:transition-colors duration-100",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                className,
            )}
            {...props}
        />
    );
}

export function StatItemValue({
    className,
    loading = false,
    ...props
}: ComponentProps<"div"> & { loading?: boolean }) {
    return loading ? (
        <Skeleton className="w-20 h-9" />
    ) : (
        <div
            data-slot="stat-item-value"
            className={cn("text-4xl font-bold leading-none", className)}
            {...props}
        />
    );
}

export function StatItemTitle({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="stat-item-title"
            className={cn("text-md font-semibold", className)}
            {...props}
        />
    );
}

export function StatItemDescription({
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <div
            data-slot="stat-item-description"
            className={cn(
                "text-sm text-center text-muted-foreground",
                className,
            )}
            {...props}
        />
    );
}
