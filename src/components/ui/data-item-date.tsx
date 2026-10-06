/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import React from "react";

import { usePreferences } from "@/hooks/use-preferences";
import { cn } from "@/lib/utils";

/**
 * The value cell used by every entity "Created"/"Updated" row: the timestamp on one line, and how
 * long ago it was on the next. Use it in an `inline` `DataItem`.
 *
 * Lives apart from the rest of `data-item.tsx` because it's the one piece that has to be a Client
 * Component — it reads the viewer's `display.dateFormat`/`display.timeFormat` presets through
 * `usePreferences()`. Keeping `DataList`/`DataItem` in a module with no `"use client"` leaves
 * them usable from the Server Components that import them.
 *
 * Re-exported from `data-item.tsx`, so call sites import it alongside its siblings.
 */
export function DataItemDateValue({
    className,
    date,
    ...props
}: Omit<React.ComponentPropsWithRef<"div">, "children"> & { date: Date | string }) {
    const { formatDateTime, formatRelativeDateTime } = usePreferences();

    return (
        <div
            data-component="DataItemDateValue"
            className={cn("min-w-0 break-words text-foreground [grid-area:value]", className)}
            {...props}
        >
            <time dateTime={new Date(date).toISOString()} className="block">
                {formatDateTime(date)}
            </time>
            <div className="text-muted-foreground">{formatRelativeDateTime(date)}</div>
        </div>
    );
}
