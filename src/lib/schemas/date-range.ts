/*
 *  Copyright (c) 2025 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { formatDate, type DisplayPreferences } from "../datetime";

export type DateRange = z.infer<typeof DateRange.schema>;

export const DateRange = {
    schema: z.object({
        from: z.iso.date().optional(),
        to: z.iso.date().optional(),
    }),
} as const;

export function formatDateRange(
    range: { from?: string | Date; to?: string | Date },
    prefs: DisplayPreferences,
) {
    if (range.from) {
        const fromStr = formatDate(range.from, prefs);
        if (range.to) {
            const toStr = formatDate(range.to, prefs);
            return `${fromStr} to ${toStr}`;
        } else {
            return `until ${fromStr}`;
        }
    } else if (range.to) {
        const toStr = formatDate(range.to, prefs);
        return `from ${toStr}`;
    } else {
        return "any date";
    }
}
