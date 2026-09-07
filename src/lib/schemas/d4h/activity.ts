/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

/**
 * An event, exercise, or incident as returned by the D4H list/detail endpoints,
 * reduced to the fields the "today" view needs. `resourceType` is not required —
 * the caller knows which endpoint each record came from.
 */
export const D4HActivity = {
    schema: z.object({
        id: z.number(),
        reference: z
            .string()
            .nullish()
            .transform((v) => v ?? null),
        referenceDescription: z
            .string()
            .nullish()
            .transform((v) => v ?? null),
        startsAt: z.string(),
        endsAt: z.string(),
        address: z
            .object({
                street: z.string().nullish(),
                town: z.string().nullish(),
                region: z.string().nullish(),
                country: z.string().nullish(),
            })
            .nullish(),
    }),
} as const;

export type D4HActivity = z.infer<typeof D4HActivity.schema>;

/** A single-line location label from a D4H activity address, or null if there's nothing useful. */
export function formatD4HActivityLocation(address: D4HActivity["address"]): string | null {
    if (!address) return null;
    const parts = [address.street, address.town, address.region].filter(
        (p): p is string => !!p && p.trim().length > 0,
    );
    return parts.length > 0 ? parts.join(", ") : null;
}
