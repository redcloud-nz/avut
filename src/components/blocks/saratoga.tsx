/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Saratoga layout components.
 *
 */

import type { Route } from "next";
import Link from "next/link";
import { ComponentProps, Fragment, ReactNode } from "react";
import { tv, VariantProps } from "tailwind-variants";

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

import { SaratogaContents, SaratogaContentsSpacer } from "./saratoga-contents";

function SaratogaRoot({ children, className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-component="SaratogaRoot"
            className={cn("w-full max-w-5xl mx-auto space-y-2", className)}
            {...props}
        >
            {children}
        </div>
    );
}

function SaratogaHeader({ children, className, ...props }: ComponentProps<"header">) {
    return (
        <header
            data-component="SaratogaHeader"
            className={cn("flex gap-2 justify-between", className)}
            {...props}
        >
            {children}
        </header>
    );
}

/** One ancestor in a page's breadcrumb trail. Every ancestor is a link. */
export type SaratogaBreadcrumb = { label: string; href: Route };

/**
 * The trail of pages above this one, rendered in the page directly above `Saratoga.Header` rather
 * than in the navbar. Ancestors only: the page's own `<h1>` is the current crumb, so it isn't
 * repeated. On a narrow screen the trail stays on one line and each ancestor truncates.
 */
function SaratogaBreadcrumbs({
    items,
    className,
}: {
    items: SaratogaBreadcrumb[];
    className?: string;
}) {
    return (
        <Breadcrumb data-component="SaratogaBreadcrumbs" className={className}>
            <BreadcrumbList className="flex-nowrap text-xs">
                {items.map((item, idx) => (
                    <Fragment key={idx}>
                        {idx > 0 && <BreadcrumbSeparator />}
                        <BreadcrumbItem className="min-w-0">
                            <BreadcrumbLink asChild>
                                <Link href={item.href} className="truncate">
                                    {item.label}
                                </Link>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                    </Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    );
}

/**
 * The page's `<h1>`. A long title truncates with an ellipsis.
 *
 * `badges` (e.g. a record's non-normal status: "Archived", "Withdrawn") render beside the `<h1>`,
 * not inside it, so they stay visible when the title truncates and stay out of the heading's
 * accessible name. When the title and badges don't fit on one line (a long title, a narrow screen)
 * the badges drop to the next row, and the title, alone on its line, truncates.
 */
function SaratogaTitle({
    children,
    className,
    badges,
    ...props
}: ComponentProps<"h1"> & { badges?: ReactNode }) {
    const title = (
        <h1
            data-component="SaratogaTitle"
            className={cn(
                "scroll-m-20 text-xl font-semibold tracking-tight overflow-hidden text-ellipsis whitespace-nowrap",
                className,
            )}
            {...props}
        >
            {children}
        </h1>
    );

    if (!badges) return title;

    return (
        <div
            data-component="SaratogaTitleGroup"
            className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
        >
            {title}
            <div className="flex shrink-0 items-center gap-2 empty:hidden">{badges}</div>
        </div>
    );
}

function SaratogaActions({ children, className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-component="SaratogaActions"
            className={cn("flex items-center justify-end gap-2", className)}
            {...props}
        >
            {children}
        </div>
    );
}

const columnsVariants = tv({
    base: "grid grid-cols-1  gap-4",
    variants: {
        variant: {
            "2-1": "lg:grid-cols-[2fr_1fr]",
            "1-1": "lg:grid-cols-[1fr_1fr]",
            "1-2": "lg:grid-cols-[1fr_2fr]",
        },
    },
    defaultVariants: {
        variant: "2-1",
    },
});

function SaratogaColumns({
    children,
    className,
    variant,
    ...props
}: ComponentProps<"div"> & VariantProps<typeof columnsVariants>) {
    return (
        <div
            data-component="SaratogaColumns"
            className={cn(columnsVariants({ variant }), className)}
            {...props}
        >
            {children}
        </div>
    );
}

function SaratogaColumn({
    children,
    className,
    slot,
    ...props
}: ComponentProps<"div"> & { slot: "list" | "main" | "secondary" }) {
    return (
        <div
            data-component="SaratogaColumn"
            data-slot={slot}
            className={cn("space-y-4", className)}
            {...props}
        >
            {children}
        </div>
    );
}

export const Saratoga = {
    Root: SaratogaRoot,
    Breadcrumbs: SaratogaBreadcrumbs,
    Header: SaratogaHeader,
    Title: SaratogaTitle,
    Actions: SaratogaActions,
    Columns: SaratogaColumns,
    Column: SaratogaColumn,
    Contents: SaratogaContents,
    ContentsSpacer: SaratogaContentsSpacer,
};
