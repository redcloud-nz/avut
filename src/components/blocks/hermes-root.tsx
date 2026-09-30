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
import { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Must be rendered from the `layout.tsx` whose child segment is the record id (e.g. the notes
 * layout above `[note_id]`), so `useSelectedLayoutSegment()` returns `null` on the index route
 * and the record id on a record.
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
