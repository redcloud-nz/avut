/*
 *  Copyright (c) 2025 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { format, parseISO } from "date-fns";
import * as z from "zod";

import { DATE_FORMAT_PATTERNS, type DisplayPreferences } from "../datetime";

export type DateRange = z.infer<typeof DateRange.schema>;

export const DateRange = {
    schema: z.object({
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
    }),
} as const;

/**
 * A plain calendar date (`YYYY-MM-DD`) in the viewer's `dateFormat` preset. Not `formatDate`,
 * which treats its input as an instant: a bare ISO date parses as UTC midnight there, so a
 * viewer west of UTC would see the day before. A plain date names a day, not an instant, so it
 * renders without any time zone shift.
 */
export function formatPlainDate(isoDate: string, prefs: DisplayPreferences): string {
    // `parseISO` reads a date-only string as local midnight, so formatting it locally gives the
    // same calendar day back.
    return format(parseISO(isoDate), DATE_FORMAT_PATTERNS[prefs.dateFormat]);
}

/** A `DateRange` for display: both ends inclusive, either may be open. */
export function formatDateRange(range: DateRange, prefs: DisplayPreferences) {
    const from = range.from ? formatPlainDate(range.from, prefs) : undefined;
    const to = range.to ? formatPlainDate(range.to, prefs) : undefined;

    if (from && to) return `${from} to ${to}`;
    if (from) return `from ${from}`;
    if (to) return `until ${to}`;
    return "any date";
}
