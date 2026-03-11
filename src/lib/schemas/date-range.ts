/*
 *  Copyright (c) 2025 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";
import { formatDate } from "../datetime";

export type DateRange = z.infer<typeof DateRange.schema>;

export const DateRange = {
    schema: z.object({
        from: z.string().date().optional(),
        to: z.string().date().optional(),
    }),
} as const;

export function formatDateRange(range: {
    from?: string | Date;
    to?: string | Date;
}) {
    if (range.from) {
        const fromStr = formatDate(range.from);
        if (range.to) {
            const toStr = formatDate(range.to);
            return `${fromStr} to ${toStr}`;
        } else {
            return `until ${fromStr}`;
        }
    } else if (range.to) {
        const toStr = formatDate(range.to);
        return `from ${toStr}`;
    } else {
        return "any date";
    }
}
