/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import React from "react";

import { cn } from "@/lib/utils";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";

export function DL({ className, ...props }: React.ComponentPropsWithRef<"dl">) {
    return (
        <dl
            data-component="DL"
            className={cn(
                "grid text-sm/6 sm:grid-cols-[min(30%,--spacing(80))_auto] sm:text-sm -my-3",
                className,
            )}
            {...props}
        />
    );
}

export function DLTerm({ className, ...props }: React.ComponentPropsWithRef<"dt">) {
    return (
        <dt
            data-component="DLTerm"
            className={cn(
                "col-start-1 border-t border-border/50 pt-3 text-foreground font-medium select-none first:border-none sm:border-t sm:py-3",
                className,
            )}
            {...props}
        />
    );
}

export function DLDetails({ className, ...props }: React.ComponentPropsWithRef<"dd">) {
    return (
        <dd
            data-component="DLDetails"
            className={cn(
                "pb-3 pt-1 text-foreground sm:border-t sm:border-border/50 sm:py-3 sm:nth-2:border-none",
                className,
            )}
            {...props}
        />
    );
}

/**
 * Like `DL`, but with a third column for a per-row action (e.g. an edit/change button) —
 * use `DLAction` for that third cell alongside the usual `DLTerm`/`DLDetails` pair. A row
 * with nothing to do there can simply omit `DLAction`; the grid just leaves that cell empty.
 */
export function DLActions({ className, ...props }: React.ComponentPropsWithRef<"dl">) {
    return (
        <dl
            data-component="DLActions"
            className={cn(
                "grid text-sm/6 sm:grid-cols-[min(30%,--spacing(80))_auto_auto] sm:text-sm -my-3",
                className,
            )}
            {...props}
        />
    );
}

export function DLAction({ className, ...props }: React.ComponentPropsWithRef<"div">) {
    return (
        <div
            data-component="DLAction"
            className={cn(
                "flex items-center justify-end pb-3 pt-1 sm:border-t sm:border-border/50 sm:py-3 sm:nth-3:border-none",
                className,
            )}
            {...props}
        />
    );
}

export function DLDateDetails({
    className,
    date,
    ...props
}: Omit<React.ComponentPropsWithRef<"dd">, "children"> & { date: Date | string }) {
    return (
        <dd
            data-component="DLDateDetails"
            className={cn(
                "pb-3 pt-1 text-foreground sm:border-t sm:border-border/50 sm:py-3 sm:nth-2:border-none",
                className,
            )}
            {...props}
        >
            <div>{formatDateTime(date)}</div>
            <div className="text-muted-foreground">{formatRelativeDateTime(date)}</div>
        </dd>
    );
}
