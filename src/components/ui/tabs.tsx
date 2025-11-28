/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { tv } from "tailwind-variants";

export const Tabs = TabsPrimitive.Root;

const tabsListVariants = tv({
    base: "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
    variants: {
        variant: {
            default: "",
            stretch: "w-full [&>[data-slot=trigger]]:flex-1",
        },
    },
    defaultVariants: {
        variant: "default",
    },
});

export function TabsList({
    className,
    variant,
    ...props
}: React.ComponentPropsWithRef<typeof TabsPrimitive.List> & {
    variant?: "default" | "stretch";
}) {
    return (
        <TabsPrimitive.List
            className={tabsListVariants({ className, variant })}
            {...props}
        />
    );
}

export function TabsTrigger({
    className,
    ...props
}: React.ComponentPropsWithRef<typeof TabsPrimitive.Trigger>) {
    return (
        <TabsPrimitive.Trigger
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none disabled:opacity-50",
                "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs",
                className,
            )}
            data-slot="trigger"
            {...props}
        />
    );
}

export function TabsContent({
    className,
    ...props
}: React.ComponentPropsWithRef<typeof TabsPrimitive.Content>) {
    return (
        <TabsPrimitive.Content
            className={cn(
                "mt-2 ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                className,
            )}
            {...props}
        />
    );
}
