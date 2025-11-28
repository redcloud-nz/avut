/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

import { Accordion as AccordionPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({
    className,
    ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
    return (
        <AccordionPrimitive.Item
            className={cn("border-b", className)}
            {...props}
        />
    );
}

export function AccordionTrigger({
    className,
    children,
    ...props
}: React.ComponentPropsWithRef<typeof AccordionPrimitive.Trigger>) {
    return (
        <AccordionPrimitive.Header className="flex">
            <AccordionPrimitive.Trigger
                className={cn(
                    "flex flex-1 items-center justify-between py-4 font-medium transition-all [&[data-state=open]>svg]:rotate-180",
                    className,
                )}
                {...props}
            >
                {children}
                <ChevronDownIcon className="h-4 w-4 shrink-0 transition-transform duration-200" />
            </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
    );
}

export function AccordionContent({
    className,
    children,
    ...props
}: React.ComponentPropsWithRef<typeof AccordionPrimitive.Content>) {
    return (
        <AccordionPrimitive.Content
            className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
            {...props}
        >
            <div className={cn("pb-4 pt-0", className)}>{children}</div>
        </AccordionPrimitive.Content>
    );
}
