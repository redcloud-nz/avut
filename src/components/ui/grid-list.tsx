/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Slot as SlotPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export type GridListProps = React.ComponentProps<"ul">;

export function GridList({
    className,
    role = "list",
    ...props
}: GridListProps) {
    return (
        <ul
            className={cn(
                className,
                "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6",
            )}
            role={role}
            {...props}
        />
    );
}

export type GridListItemProps = React.ComponentProps<"li"> & {
    asChild?: boolean;
};

export function GridListItem({
    className,
    asChild = false,
    ...props
}: GridListItemProps) {
    const Comp = asChild ? SlotPrimitive.Slot : "li";

    return (
        <Comp
            className={cn(
                className,
                "col-span-1 divide-y divide-gray-200 rounded-lg border bg-card text-card-foreground shadow-xs p-6 hover:bg-gray-50 active:bg-gray-100",
            )}
            {...props}
        />
    );
}
