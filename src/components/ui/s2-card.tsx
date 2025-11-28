/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function S2_Card({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card"
            className={cn(
                "relative bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
                className,
            )}
            {...props}
        />
    );
}

export function S2_CardHeader({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-header"
            className={cn(
                "@container/card-header grid auto-rows-min grid-rows-[auto] has-data-[slot=card-description]:grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
                className,
            )}
            {...props}
        />
    );
}

export function S2_CardTitle({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-title"
            className={cn("leading-none font-semibold", className)}
            {...props}
        />
    );
}

export function S2_CardDescription({
    className,
    ...props
}: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-description"
            className={cn("text-muted-foreground text-sm", className)}
            {...props}
        />
    );
}

export function S2_CardAction({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-action"
            className={cn(
                "col-start-2 row-span-full row-start-1 self-start justify-self-end",
                className,
            )}
            {...props}
        />
    );
}

export function S2_CardContent({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-content"
            className={cn("px-6", className)}
            {...props}
        />
    );
}

export function S2_CardFooter({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-footer"
            className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
            {...props}
        />
    );
}
