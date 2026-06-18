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
