/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import React from "react";

import { cn } from "@/lib/utils";

// `DataItemDateValue` has to be a Client Component (it reads the viewer's format preferences), and
// this module is imported by Server Components. Re-exported so call sites take every piece from
// one import.
export { DataItemDateValue } from "./data-item-date";

/**
 * The container for a card's `DataItem` rows. It is the grid: three shared column tracks
 * (title, value, action) that every row joins through `grid-cols-subgrid`, so the values of a
 * card's rows start at the same x.
 *
 * - From `sm` up the title track is `min(30%, --spacing(80))`.
 * - Below `sm` it sizes to the widest `inline` row's title, capped at 35% of the list, past
 *   which a long title wraps instead of squeezing its value. Stacked rows span the title and
 *   value tracks, so they don't widen it.
 * - The value track is `minmax(0, 1fr)`, so a long value wraps rather than widening the list.
 * - The action track is `auto`, shared by every row in the list.
 * - Below `sm` the spacing between tracks is padding on `DataItemTitle`/`DataItemAction` rather
 *   than a column gap, so a list with no actions doesn't lose a gap's width beside an empty
 *   action track — at 320px that is the difference between a timestamp fitting on one line or
 *   not. From `sm` up it is a plain `gap-x-4`, as before.
 *
 * Rows must be **direct children** (fragments are fine): a wrapper element between the list and
 * a `DataItem` — a `Suspense` fallback `<div>`, a `<Protect>` that renders a div — drops that
 * row out of the shared tracks.
 *
 * The `-my-3` offsets the first and last row's `py-3` against `CardContent`'s own padding.
 */
export function DataList({ className, ...props }: React.ComponentPropsWithRef<"div">) {
    return (
        <div
            data-component="DataList"
            className={cn(
                "-my-3 grid grid-cols-[fit-content(35%)_minmax(0,1fr)_auto] text-sm/6 sm:grid-cols-[min(30%,--spacing(80))_minmax(0,1fr)_auto] sm:gap-x-4",
                className,
            )}
            {...props}
        />
    );
}

/**
 * A single title/value/action row inside a `DataList`. Each row is a subgrid of the list's
 * columns, so `DataItemAction` stays pinned to the top-right of the row on narrow screens instead
 * of wrapping below `DataItemValue`.
 *
 * - Without `inline`, the row stacks below `sm`: the title (with the action beside it) on one
 *   line, the value on its own line below. Use it for long or multi-line values — descriptions,
 *   notes, emails.
 * - With `inline`, the title, value and action sit side by side at every width, aligned to the
 *   top so a two-line value keeps its title on the first line. Use it for short values — IDs,
 *   names, dates, statuses.
 *
 * From `sm` up both put title, value and action on one line; inline rows still align to the
 * top, so a two-line value (a date) keeps its label on the first line.
 */
export function DataItem({
    className,
    inline = false,
    ...props
}: React.ComponentPropsWithRef<"div"> & { inline?: boolean }) {
    return (
        <div
            data-component="DataItem"
            className={cn(
                "col-span-full grid grid-cols-subgrid gap-y-1 border-t border-border/50 py-3 first:border-none sm:[grid-template-areas:'title_value_action']",
                inline
                    ? "items-start [grid-template-areas:'title_value_action']"
                    : "items-center [grid-template-areas:'title_title_action'_'value_value_value']",
                className,
            )}
            {...props}
        />
    );
}

export function DataItemTitle({ className, ...props }: React.ComponentPropsWithRef<"div">) {
    return (
        <div
            data-component="DataItemTitle"
            className={cn(
                "min-w-0 select-none wrap-break-word pr-4 font-medium text-foreground [grid-area:title] sm:pr-0",
                className,
            )}
            {...props}
        />
    );
}

export function DataItemValue({ className, ...props }: React.ComponentPropsWithRef<"div">) {
    return (
        <div
            data-component="DataItemValue"
            className={cn("min-w-0 wrap-break-word text-foreground [grid-area:value]", className)}
            {...props}
        />
    );
}

/** Omit this when a row has nothing to do — the grid just leaves that cell empty. */
export function DataItemAction({ className, ...props }: React.ComponentPropsWithRef<"div">) {
    return (
        <div
            data-component="DataItemAction"
            className={cn(
                "flex items-center justify-end pl-4 [grid-area:action] sm:pl-0",
                className,
            )}
            {...props}
        />
    );
}
