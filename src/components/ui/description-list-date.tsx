/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import React from "react";

import { usePreferences } from "@/hooks/use-preferences";
import { cn } from "@/lib/utils";

/**
 * The `<dd>` used by every entity "Created"/"Updated" card: the timestamp on one line, and how
 * long ago it was on the next.
 *
 * Lives apart from the rest of `description-list.tsx` because it's the one piece that has to be
 * a Client Component — it reads the viewer's `display.dateFormat`/`display.timeFormat` presets
 * through `usePreferences()`. Keeping `DL`/`DLTerm`/`DLDetails` in a module with no `"use
 * client"` leaves them usable from the Server Components that import them.
 *
 * Re-exported from `description-list.tsx`, so call sites import it alongside its siblings.
 */
export function DLDateDetails({
    className,
    date,
    ...props
}: Omit<React.ComponentPropsWithRef<"dd">, "children"> & { date: Date | string }) {
    const { formatDateTime, formatRelativeDateTime } = usePreferences();

    return (
        <dd
            data-component="DLDateDetails"
            className={cn(
                "pb-3 pt-1 text-foreground sm:border-t sm:border-border/50 sm:py-3 sm:nth-2:border-none",
                className,
            )}
            {...props}
        >
            <div>{formatDateTime(date)}</div>
            <div className="text-muted-foreground">{formatRelativeDateTime(date)}</div>
        </dd>
    );
}
