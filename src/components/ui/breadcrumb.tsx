/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";
import { ComponentProps } from "react";

import { Slot as SlotPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

export function Breadcrumb({ ...props }: ComponentProps<"nav">) {
    return <nav aria-label="breadcrumb" data-slot="breadcrumb" {...props} />;
}

export function BreadcrumbList({ className, ...props }: ComponentProps<"ol">) {
    return (
        <ol
            data-slot="breadcrumb-list"
            className={cn(
                "text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs wrap-break-word",
                className,
            )}
            {...props}
        />
    );
}

export function BreadcrumbItem({ className, ...props }: ComponentProps<"li">) {
    return (
        <li
            data-slot="breadcrumb-item"
            className={cn("inline-flex items-center gap-1", className)}
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
            data-slot="breadcrumb-link"
            className={cn("transition-colors hover:text-foreground", className)}
            {...props}
        />
    );
}

export function BreadcrumbPage({
    className,
    ...props
}: ComponentProps<"span">) {
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
}: ComponentProps<"li">) {
    return (
        <li
            data-slot="breadcrumb-separator"
            role="presentation"
            aria-hidden="true"
            className={cn("[&>svg]:size-3.5", className)}
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
            data-slot="breadcrumb-ellipsis"
            role="presentation"
            aria-hidden="true"
            className={cn(
                "flex size-5 items-center justify-center [&>svg]:size-4",
                className,
            )}
            {...props}
        >
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
        </span>
    );
}
