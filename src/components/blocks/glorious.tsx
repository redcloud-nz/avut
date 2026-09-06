/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Glorious layout components — a full-height, edge-to-edge scrolling matrix table.
 *
 * Extracted from the skill-matrix report: a fixed-layout table inside a single scroll
 * frame, with sticky column headers and per-group <tbody> sections whose sticky heading
 * releases at the section boundary.
 */

"use client";

import { ComponentProps, ReactNode, useState } from "react";

import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function GloriousRoot({ children, className, ...props }: ComponentProps<"main">) {
    return (
        <main
            data-component="GloriousRoot"
            className={cn("relative flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4", className)}
            {...props}
        >
            {children}
        </main>
    );
}

function GloriousHeader({ children, className, ...props }: ComponentProps<"header">) {
    return (
        <header
            data-component="GloriousHeader"
            className={cn("flex flex-wrap items-start justify-between gap-2", className)}
            {...props}
        >
            {children}
        </header>
    );
}

function GloriousTitle({ children, className, ...props }: ComponentProps<"h1">) {
    return (
        <h1
            data-component="GloriousTitle"
            className={cn("text-lg font-semibold", className)}
            {...props}
        >
            {children}
        </h1>
    );
}

function GloriousSubtitle({ children, className, ...props }: ComponentProps<"p">) {
    return (
        <p
            data-component="GloriousSubtitle"
            className={cn("text-sm text-muted-foreground", className)}
            {...props}
        >
            {children}
        </p>
    );
}

function GloriousActions({ children, className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-component="GloriousActions"
            className={cn("flex items-center justify-end gap-2", className)}
            {...props}
        >
            {children}
        </div>
    );
}

function GloriousScrollFrame({ children, className, ...props }: ComponentProps<"div">) {
    return (
        <div
            data-component="GloriousScrollFrame"
            className={cn("min-h-0 min-w-0 flex-1 overflow-auto rounded-md border", className)}
            {...props}
        >
            {children}
        </div>
    );
}

function GloriousTable({ children, className, ...props }: ComponentProps<"table">) {
    return (
        <table
            data-component="GloriousTable"
            className={cn("table-fixed border-separate border-spacing-0 text-sm", className)}
            {...props}
        >
            {children}
        </table>
    );
}

function GloriousTableHeader({ children, className, ...props }: ComponentProps<"tr">) {
    return (
        <thead data-component="GloriousTableHeader">
            <tr className={className} {...props}>
                {children}
            </tr>
        </thead>
    );
}

/**
 * One <tbody> per group. The heading row sticks below the column header while scrolling
 * and releases when the <tbody> scrolls past. Holds its own collapsed state.
 *
 * `headerOffset` is the height (px) of the sticky column header the heading pins beneath.
 * `colSpan` must cover every column so the heading row spans the full table width.
 */
function GloriousGroupSection({
    label,
    headerOffset,
    colSpan,
    defaultCollapsed = false,
    children,
}: {
    label: ReactNode;
    headerOffset: number;
    colSpan: number;
    defaultCollapsed?: boolean;
    children: ReactNode;
}) {
    const [collapsed, setCollapsed] = useState(defaultCollapsed);

    return (
        <tbody data-component="GloriousGroupSection">
            <tr>
                <th
                    colSpan={colSpan}
                    style={{ top: headerOffset }}
                    className="sticky z-20 bg-muted p-0 text-left"
                >
                    {/* Full-width wrapper carries the divider — a border on the sticky <th>
                        itself paints unreliably once it's stuck. The button stays narrow so
                        it has room to stick horizontally. */}
                    <div className="border-b">
                        <button
                            type="button"
                            onClick={() => setCollapsed((value) => !value)}
                            aria-expanded={!collapsed}
                            className="sticky left-0 z-10 flex w-fit items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground"
                        >
                            <ChevronDownIcon
                                className={cn(
                                    "size-3.5 transition-transform",
                                    collapsed && "-rotate-90",
                                )}
                            />
                            {label}
                        </button>
                    </div>
                </th>
            </tr>
            {!collapsed && children}
        </tbody>
    );
}

export const Glorious = {
    Root: GloriousRoot,
    Header: GloriousHeader,
    Title: GloriousTitle,
    Subtitle: GloriousSubtitle,
    Actions: GloriousActions,
    ScrollFrame: GloriousScrollFrame,
    Table: GloriousTable,
    TableHeader: GloriousTableHeader,
    GroupSection: GloriousGroupSection,
};
