/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Popover as PopoverPrimitive } from "radix-ui";
import { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Popover({
    ...props
}: ComponentProps<typeof PopoverPrimitive.Root>) {
    return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

export function PopoverTrigger({
    ...props
}: ComponentProps<typeof PopoverPrimitive.Trigger>) {
    return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

export function PopoverContent({
    className,
    align = "center",
    sideOffset = 4,
    ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
    return (
        <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
                data-slot="popover-content"
                align={align}
                sideOffset={sideOffset}
                className={cn(
                    "bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/10 z-50 flex w-72 origin-(--radix-popover-content-transform-origin) flex-col gap-2.5 rounded-none p-2.5 text-xs shadow-md ring-1 outline-hidden duration-100",
                    className,
                )}
                {...props}
            />
        </PopoverPrimitive.Portal>
    );
}

export function PopoverAnchor({
    ...props
}: ComponentProps<typeof PopoverPrimitive.Anchor>) {
    return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export function PopoverHeader({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-slot="popover-header"
            className={cn("flex flex-col gap-1 text-xs", className)}
            {...props}
        />
    );
}

export function PopoverTitle({ className, ...props }: ComponentProps<"h2">) {
    return (
        <div
            data-slot="popover-title"
            className={cn("text-sm font-medium", className)}
            {...props}
        />
    );
}

export function PopoverDescription({
    className,
    ...props
}: ComponentProps<"p">) {
    return (
        <p
            data-slot="popover-description"
            className={cn("text-muted-foreground text-xs/relaxed", className)}
            {...props}
        />
    );
}
