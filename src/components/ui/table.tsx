/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * This file is largely identical as `table.tsx` but has been added to support returning to shadcn from components that had substantially drifted.
 */

"use client";

import { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

type TableProps = ComponentProps<"table"> & {
    footer?: ReactNode;
    slotProps?: {
        container?: Omit<ComponentProps<"div">, "children">;
    };
};

export function Table({
    className,
    footer,
    slotProps: { container = {} } = {},
    ...props
}: TableProps) {
    const { className: containerClassName, ...containerProps } = container;

    return (
        <div
            data-slot="table-container"
            className={cn("w-full", containerClassName)}
            {...containerProps}
        >
            <table
                data-slot="table"
                className={cn("w-full caption-bottom text-sm", className)}
                {...props}
            />
            {footer}
        </div>
    );
}

export function TableHeader({ className, ...props }: ComponentProps<"thead">) {
    return (
        <thead
            data-slot="table-header"
            className={cn("[&_tr]:border-b", className)}
            {...props}
        />
    );
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
    return (
        <tbody
            data-slot="table-body"
            className={cn("[&_tr:last-child]:border-0", className)}
            {...props}
        />
    );
}

export function TableFooter({ className, ...props }: ComponentProps<"tfoot">) {
    return (
        <tfoot
            data-slot="table-footer"
            className={cn(
                "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
                className,
            )}
            {...props}
        />
    );
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
    return (
        <tr
            data-slot="table-row"
            className={cn(
                "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
                className,
            )}
            {...props}
        />
    );
}

export function TableHeadCell({ className, ...props }: ComponentProps<"th">) {
    return (
        <th
            data-slot="table-head"
            className={cn(
                "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0",
                className,
            )}
            {...props}
        />
    );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
    return (
        <td
            data-slot="table-cell"
            className={cn(
                "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
                className,
            )}
            {...props}
        />
    );
}

export function TableCaption({
    className,
    ...props
}: ComponentProps<"caption">) {
    return (
        <caption
            data-slot="table-caption"
            className={cn("text-muted-foreground mt-4 text-sm", className)}
            {...props}
        />
    );
}
