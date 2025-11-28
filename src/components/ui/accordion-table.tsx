/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ChevronDownIcon } from "lucide-react";
import { ComponentProps } from "react";

import { Accordion as AccordionPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * A table-like component with accordion (expand/collapse) functionality.
 *
 * Uses CSS grid for layout. The number of columns needs to be defined by specifying the `grid-template-columns` on the this component.
 *
 * @example
 * <ATable className="grid-cols-[40px_1fr_1fr_100px]">
 *   <ATableHead>
 *    <ATableHeadRow>
 *      <ATableHeadCell></ATableHeadCell>
 *      <ATableHeadCell>Column 1</ATableHeadCell>
 *      <ATableHeadCell>Column 2</ATableHeadCell>
 *      <ATableHeadCell>Actions</ATableHeadCell>
 *   </ATableHead>
 *   <ATableBody>
 *     ...rows and sections here...
 *   </ATableBody>
 * </ATable>
 *
 */
export function ATable({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "grid text-sm p-1 divide-y divide-gray-300",
                className,
            )}
            role="treegrid"
            data-component="ATable"
            {...props}
        />
    );
}

export function ATableHead({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "grid col-span-full grid-cols-subgrid border-b",
                className,
            )}
            data-component="ATableHead"
            {...props}
        />
    );
}

export function ATableBody({
    children,
    className,
    type = "single",
}: Pick<
    ComponentProps<typeof AccordionPrimitive.Root>,
    "className" | "children" | "type"
>) {
    return (
        <AccordionPrimitive.Root
            className={cn(
                "grid col-span-full grid-cols-subgrid divide-y divide-gray-200",
                className,
            )}
            data-component="ATableBody"
            type={type}
        >
            {children}
        </AccordionPrimitive.Root>
    );
}

export function ATableHeadRow({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "grid col-span-full grid-cols-subgrid items-center pl-1 last:border-0 transition-colors hover:bg-muted/50",
                className,
            )}
            data-component="ATableRow"
            {...props}
        />
    );
}

export function ATableHeadCell({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "h-10 px-2 pt-3 pb-1 align-middle font-medium",
                className,
            )}
            role="columnheader"
            data-component="ATableHeadCell"
            {...props}
        />
    );
}

export function ATableSection({
    className,
    ...props
}: ComponentProps<typeof AccordionPrimitive.Item>) {
    return (
        <AccordionPrimitive.Item
            className={cn("grid col-span-full grid-cols-subgrid", className)}
            data-component="ATableSection"
            {...props}
        />
    );
}

export function ATableSectionHeader({
    className,
    ...props
}: ComponentProps<typeof AccordionPrimitive.Header>) {
    return (
        <AccordionPrimitive.Header
            className={cn(
                "grid col-span-full grid-cols-subgrid items-center pl-1 last:border-0 transition-colors hover:bg-muted/50",
                className,
            )}
            data-component="ATableHeader"
            {...props}
        />
    );
}

export function ATableTrigger({
    className,
}: ComponentProps<typeof AccordionPrimitive.Trigger>) {
    return (
        <AccordionPrimitive.Trigger asChild>
            <Button
                variant="ghost"
                size="icon"
                className={cn(
                    "transition-all [&[data-state=open]>svg]:rotate-180",
                    className,
                )}
                data-component="ATableTrigger"
            >
                <ChevronDownIcon
                    className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-200",
                        className,
                    )}
                />
            </Button>
        </AccordionPrimitive.Trigger>
    );
}

export function ATableSectionContent({
    className,
    ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) {
    return (
        <AccordionPrimitive.Content
            className={cn("grid col-span-full grid-cols-subgrid", className)}
            data-component="ATableSectionContent"
            {...props}
        />
    );
}

export function ATableRow({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn(
                "grid col-span-full grid-cols-subgrid hover:bg-muted/50",
                className,
            )}
            data-component="ATableRow"
            {...props}
        />
    );
}

export function ATableCell({ className, ...props }: ComponentProps<"div">) {
    return (
        <div
            className={cn("h-9 p-2 align-middle", className)}
            role="gridcell"
            data-component="ATableCell"
            {...props}
        />
    );
}
