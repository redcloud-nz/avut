/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { type ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Card({
    className,
    size = "default",
    ...props
}: ComponentProps<"div"> & { size?: "default" | "sm" }) {
    return (
        <div
            data-slot="card"
            data-size={size}
            className={cn(
                "group/card ",
                // Background color and text
                "bg-card text-card-foreground text-xs/relaxed",
                // Layout
                "flex flex-col gap-4 py-4 overflow-hidden",
                // Border and shadow
                "rounded-none ring-1 ring-foreground/10",
                // Small size adjustments
                "data-[size=sm]:gap-3 data-[size=sm]:py-3",
                // Image handling
                "has-[>img:first-child]:pt-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
                // Footer handling
                "has-data-[slot=card-footer]:pb-0 data-[size=sm]:has-data-[slot=card-footer]:pb-0",
            )}
            {...props}
        />
    );
}

export function CardHeader({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-header"
            className={cn(
                "group/card-header @container/card-header gap-1 rounded-none px-4  grid auto-rows-min items-start",
                "group-data-[size=sm]/card:px-3 [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3",
                "has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
                className,
            )}
            {...props}
        />
    );
}

export function CardTitle({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-title"
            className={cn("text-sm font-medium group-data-[size=sm]/card:text-sm", className)}
            {...props}
        />
    );
}

export function CardDescription({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-description"
            className={cn("text-muted-foreground text-xs/relaxed", className)}
            {...props}
        />
    );
}

export function CardAction({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-action"
            className={cn(
                "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
                className,
            )}
            {...props}
        />
    );
}

export function CardContent({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-content"
            className={cn("px-4 group-data-[size=sm]/card:px-3", className)}
            {...props}
        />
    );
}

export function CardFooter({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="card-footer"
            className={cn(
                "flex items-center gap-2 rounded-none p-4 group-data-[size=sm]/card:p-3 [.border-t]:pt-4 group-data-[size=sm]/card:[.border-t]:pt-3",
                className,
            )}
            {...props}
        />
    );
}
