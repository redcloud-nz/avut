/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps } from "react";

import { Popover as PopoverPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;

export const PopoverTrigger = PopoverPrimitive.Trigger;

export const PopoverClose = PopoverPrimitive.Close;

export const PopoverArrow = PopoverPrimitive.Arrow;

export function PopoverContent({
    children,
    className,
    align = "center",
    portal = true,
    sideOffset = 4,
    ...props
}: ComponentProps<typeof PopoverPrimitive.Content> & { portal?: boolean }) {
    const content = (
        <PopoverPrimitive.Content
            align={align}
            sideOffset={sideOffset}
            className={cn(
                "z-50 w-72 rounded-sm border bg-popover p-2 text-popover-foreground shadow-md outline-hidden",
                "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                className,
            )}
            {...props}
        >
            {children}
        </PopoverPrimitive.Content>
    );

    return portal ? (
        <PopoverPrimitive.Portal>{content}</PopoverPrimitive.Portal>
    ) : (
        content
    );
}
