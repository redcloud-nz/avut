/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import React from "react";

import { cn } from "@/lib/utils";

/**
 * A single title/value/action row, e.g. inside a settings card. Unlike `DLActions`
 * (`description-list.tsx`), each `DataItem` is its own grid — so on narrow screens
 * `DataItemAction` can stay pinned to the top-right of the row instead of wrapping
 * below `DataItemValue`, without any layout coordination between sibling rows.
 */
export function DataItem({ className, ...props }: React.ComponentPropsWithRef<"div">) {
    return (
        <div
            data-component="DataItem"
            className={cn(
                "grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-t border-border/50 py-3 text-sm/6 first:border-none [grid-template-areas:'title_action'_'value_value'] sm:grid-cols-[min(30%,--spacing(80))_1fr_auto] sm:[grid-template-areas:'title_value_action']",
                className,
            )}
            {...props}
        />
    );
}

export function DataItemTitle({ className, ...props }: React.ComponentPropsWithRef<"div">) {
    return (
        <div
            data-component="DataItemTitle"
            className={cn("select-none font-medium text-foreground [grid-area:title]", className)}
            {...props}
        />
    );
}

export function DataItemValue({ className, ...props }: React.ComponentPropsWithRef<"div">) {
    return (
        <div
            data-component="DataItemValue"
            className={cn("text-foreground [grid-area:value]", className)}
            {...props}
        />
    );
}

/** Omit this when a row has nothing to do — the grid just leaves that cell empty. */
export function DataItemAction({ className, ...props }: React.ComponentPropsWithRef<"div">) {
    return (
        <div
            data-component="DataItemAction"
            className={cn("flex items-center justify-end [grid-area:action]", className)}
            {...props}
        />
    );
}
