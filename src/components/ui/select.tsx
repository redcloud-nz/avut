/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import * as React from "react";
import { tv, VariantProps } from "tailwind-variants";

import { Select as SelectPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;

export const SelectGroup = SelectPrimitive.Group;

export const SelectValue = SelectPrimitive.Value;

export const selectTriggerVariants = tv({
    base: cn(
        "flex w-full justify-between border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground",
        "focus:outline-hidden focus:ring-2 focus:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "[&>span]:line-clamp-1",
    ),
    variants: {
        size: {
            default: "h-10 pl-4 pr-2 py-2.5 rounded-md",
            sm: "h-8 pl-3 pr-2 py-1.5 rounded-sm",
        },
    },
});

export function SelectTrigger({
    className,
    children,
    size = "default",
    ...props
}: React.ComponentPropsWithRef<typeof SelectPrimitive.Trigger> &
    VariantProps<typeof selectTriggerVariants>) {
    return (
        <SelectPrimitive.Trigger
            className={selectTriggerVariants({ className, size })}
            {...props}
        >
            {children}
            <SelectPrimitive.Icon asChild>
                <ChevronDownIcon className="h-4 w-4 opacity-50" />
            </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
    );
}

export function SelectScrollUpButton({
    className,
    ...props
}: React.ComponentPropsWithRef<typeof SelectPrimitive.ScrollUpButton>) {
    return (
        <SelectPrimitive.ScrollUpButton
            className={cn(
                "flex cursor-default items-center justify-center py-1",
                className,
            )}
            {...props}
        >
            <ChevronUpIcon className="h-4 w-4" />
        </SelectPrimitive.ScrollUpButton>
    );
}

export function SelectScrollDownButton({
    className,
    ...props
}: React.ComponentPropsWithRef<typeof SelectPrimitive.ScrollDownButton>) {
    return (
        <SelectPrimitive.ScrollDownButton
            className={cn(
                "flex cursor-default items-center justify-center py-1",
                className,
            )}
            {...props}
        >
            <ChevronDownIcon className="h-4 w-4" />
        </SelectPrimitive.ScrollDownButton>
    );
}

export function SelectContent({
    className,
    children,
    position = "popper",
    ...props
}: React.ComponentPropsWithRef<typeof SelectPrimitive.Content>) {
    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Content
                className={cn(
                    "relative z-50 max-h-96 min-w-32 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
                    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
                    "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                    position === "popper" &&
                        "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
                    className,
                )}
                position={position}
                {...props}
            >
                <SelectScrollUpButton />
                <SelectPrimitive.Viewport
                    className={cn(
                        "p-1",
                        position === "popper" &&
                            "h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)",
                    )}
                >
                    {children}
                </SelectPrimitive.Viewport>
                <SelectScrollDownButton />
            </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
    );
}

export function SelectLabel({
    className,
    ...props
}: React.ComponentPropsWithRef<typeof SelectPrimitive.Label>) {
    return (
        <SelectPrimitive.Label
            className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
            {...props}
        />
    );
}

export function SelectItem({
    className,
    children,
    ...props
}: React.ComponentPropsWithRef<typeof SelectPrimitive.Item>) {
    return (
        <SelectPrimitive.Item
            className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-hidden",
                "focus:bg-accent focus:text-accent-foreground",
                "data-disabled:pointer-events-none data-disabled:opacity-50",
                className,
            )}
            {...props}
        >
            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                <SelectPrimitive.ItemIndicator>
                    <CheckIcon className="h-4 w-4" />
                </SelectPrimitive.ItemIndicator>
            </span>

            <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        </SelectPrimitive.Item>
    );
}

export function SelectSeparator({
    className,
    ...props
}: React.ComponentPropsWithRef<typeof SelectPrimitive.Separator>) {
    return (
        <SelectPrimitive.Separator
            className={cn("-mx-1 my-1 h-px bg-muted", className)}
            {...props}
        />
    );
}
