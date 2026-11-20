/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ClientOnly } from "@/components/client-only";
import { usePreferences } from "@/hooks/use-preferences";

/**
 * A record's timestamp as `RecordCard`'s footer shows it, on one line: "Updated 01 Sep 2026
 * 12:27 · 3 months ago".
 *
 * A Client Component because it reads the viewer's date/time presets through `usePreferences()`.
 * The relative part renders only in the browser, as in `DataItemDateValue`: it reads the clock, so
 * the server's text could differ from the client's at hydration.
 */
export function RecordCardTimestamp({ label, date }: { label: string; date: Date | string }) {
    const { formatDateTime } = usePreferences();

    return (
        <span data-component="RecordCardTimestamp" className="min-w-0 truncate">
            {label} <time dateTime={new Date(date).toISOString()}>{formatDateTime(date)}</time>
            <ClientOnly fallback={null}>
                {" · "}
                <RelativeTime date={date} />
            </ClientOnly>
        </span>
    );
}

/** A component, not an inline call, so the server never reads the clock at all. */
function RelativeTime({ date }: { date: Date | string }) {
    const { formatRelativeDateTime } = usePreferences();
    return formatRelativeDateTime(date);
}
