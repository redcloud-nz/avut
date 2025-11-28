/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ComponentProps } from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { cn } from "@/lib/utils";

const tableVariants = tv({
    base: "relative overflow-auto",
    variants: {
        border: {
            true: "rounded-sm border",
        },
        width: {
            full: "w-full",
            auto: "container mx-auto",
        },
    },
});

export type TableProps = Omit<ComponentProps<"table">, "border"> &
    VariantProps<typeof tableVariants>;

export function Table({
    className,
    border = false,
    width = "full",
    ...props
}: TableProps) {
    return (
        <div className={cn(tableVariants({ border, width }), className)}>
            <table
                className={cn(
                    "w-full caption-bottom text-sm divide-y divide-gray-300",
                    className,
                )}
                {...props}
            />
        </div>
    );
}

export function TableHead({ className, ...props }: ComponentProps<"thead">) {
    return <thead className={cn("", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
    return (
        <tbody
            className={cn("divide-y divide-gray-200", className)}
            {...props}
        />
    );
}

export function TableFooter({ className, ...props }: ComponentProps<"tfoot">) {
    return <tfoot className={cn("font-medium", className)} {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
    return (
        <tr
            className={cn(
                "transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
                className,
            )}
            {...props}
        />
    );
}

export function TableHeadCell({
    children,
    className,
    ...props
}: ComponentProps<"th">) {
    return (
        <th
            className={cn(
                "h-10 px-2 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0",
                className,
            )}
            role="columnheader"
            {...props}
        >
            <div className="w-full flex justify-between items-center">
                {children}
            </div>
        </th>
    );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
    return (
        <td
            className={cn(
                "p-2 align-middle [&:has([role=checkbox])]:pr-0 overflow-hidden overflow-ellipsis hover:overflow-visible",
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
            className={cn("mt-4 text-sm text-muted-foreground", className)}
            {...props}
        />
    );
}
