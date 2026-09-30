/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * The client half of the Hermes master-detail block: the row that holds the list and detail
 * panes, and knows which one is active. It lives in its own file because `Hermes` is used from
 * server layouts, which can't dot into a `"use client"` module's exported object.
 */

"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { ComponentProps, ReactNode, ViewTransition } from "react";

import { cn } from "@/lib/utils";

/**
 * Must be rendered from the `layout.tsx` whose child segment is the record id (e.g. the notes
 * layout above `[note_id]`), so `useSelectedLayoutSegment()` returns `null` on the index route
 * and the record id on a record.
 *
 * Must also render inside `Std.SidebarInset` (or another Suspense boundary): under
 * `cacheComponents`, `useSelectedLayoutSegment()` reads a dynamic param during prerender.
 */
export function HermesRoot({ children, className, ...props }: ComponentProps<"div">) {
    const segment = useSelectedLayoutSegment();

    return (
        <div
            data-component="HermesRoot"
            data-selected={segment !== null}
            className={cn("group/hermes flex min-h-0 min-w-0 flex-1", className)}
            {...props}
        >
            {children}
        </div>
    );
}

/**
 * Wraps the detail pane's content in a `ViewTransition` keyed on the selected record, so switching
 * records (or going back to the index) crossfades the pane.
 *
 * The key lives here, above the route's page segment, not in the page. Next keeps recently left
 * pages mounted in a hidden `<Activity>` (its back/forward cache), and a `ViewTransition` inside
 * the page only formed an old/new pair on some navigations; on the rest the old record vanished
 * and the new one faded in from blank. Keyed here, every switch is a pair.
 *
 * No `Suspense` boundary may sit between this and the record's content (so no `loading.tsx` for
 * the record route): a boundary mounted under the new key shows its fallback at once, and the
 * crossfade goes to the spinner. Without one, the navigation holds the old record until the new
 * one is ready, and a hard load falls back to the nearest `loading.tsx` above the route
 * (`orgs/[slug]/loading.tsx` for org routes).
 *
 * The record id must be the layout's direct child segment, or records swap without the crossfade;
 * and the fixed `name` allows only one Hermes per screen. See `hermes.tsx`.
 */
export function HermesDetailTransition({ children }: { children: ReactNode }) {
    const segment = useSelectedLayoutSegment();

    return (
        <ViewTransition
            key={segment ?? ""}
            name="hermes-detail"
            share="auto"
            enter="auto"
            default="none"
        >
            <div className="h-full">{children}</div>
        </ViewTransition>
    );
}
