/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import * as React from "react";

import { Slot as SlotPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export function Breadcrumb({
    ...props
}: React.ComponentPropsWithRef<"nav"> & { separator?: React.ReactNode }) {
    return <nav aria-label="breadcrumb" {...props} />;
}

export function BreadcrumbList({
    className,
    ...props
}: React.ComponentPropsWithRef<"ol">) {
    return (
        <ol
            className={cn(
                "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5",
                className,
            )}
            {...props}
        />
    );
}

export function BreadcrumbItem({
    className,
    ...props
}: React.ComponentPropsWithRef<"li">) {
    return (
        <li
            className={cn("inline-flex items-center gap-1.5", className)}
            {...props}
        />
    );
}

export function BreadcrumbLink({
    asChild,
    className,
    ...props
}: React.ComponentPropsWithRef<"a"> & { asChild?: boolean }) {
    const Comp = asChild ? SlotPrimitive.Slot : "a";

    return (
        <Comp
            className={cn("transition-colors hover:text-foreground", className)}
            {...props}
        />
    );
}

export function BreadcrumbPage({
    className,
    ...props
}: React.ComponentPropsWithRef<"span">) {
    return (
        <span
            role="link"
            aria-disabled="true"
            aria-current="page"
            className={cn("font-semibold text-foreground", className)}
            {...props}
        />
    );
}

export function BreadcrumbSeparator({
    children,
    className,
    ...props
}: React.ComponentPropsWithRef<"li">) {
    return (
        <li
            role="presentation"
            aria-hidden="true"
            className={cn("[&>svg]:w-3.5 [&>svg]:h-3.5", className)}
            {...props}
        >
            {children ?? <ChevronRightIcon />}
        </li>
    );
}

export function BreadcrumbEllipsis({
    className,
    ...props
}: React.ComponentPropsWithRef<"span">) {
    return (
        <span
            role="presentation"
            aria-hidden="true"
            className={cn(
                "flex h-9 w-9 items-center justify-center",
                className,
            )}
            {...props}
        >
            <MoreHorizontalIcon className="h-4 w-4" />
            <span className="sr-only">More</span>
        </span>
    );
}
