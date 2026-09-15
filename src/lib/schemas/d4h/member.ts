/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

/** The `status` field of a D4H member, stored verbatim on `TeamMembership_D4H.d4hStatus`. */
export const D4HMemberStatus = {
    values: ["OPERATIONAL", "NON_OPERATIONAL", "OBSERVER", "RETIRED"] as const,
    schema: z.enum(["OPERATIONAL", "NON_OPERATIONAL", "OBSERVER", "RETIRED"] as const),
} as const;

export type D4HMemberStatus = z.infer<typeof D4HMemberStatus.schema>;

/**
 * Human-readable label for a D4H member status. Takes a raw string (the value is
 * stored verbatim from D4H) and falls back to the raw value for anything outside
 * the known set, so a future D4H status never renders as a blank.
 */
export function formatD4HMemberStatus(status: string): string {
    switch (status) {
        case "OPERATIONAL":
            return "Operational";
        case "NON_OPERATIONAL":
            return "Non-operational";
        case "OBSERVER":
            return "Observer";
        case "RETIRED":
            return "Retired";
        default:
            return status;
    }
}

export const D4HMember = {
    schema: z.object({
        id: z.number(),
        resourceType: z.literal("Member"),
        email: z.object({
            value: z.string(),
            verified: z.boolean(),
        }),
        name: z.string(),
        owner: z.object({
            id: z.number(),
            resourceType: z.literal("Team"),
        }),
        position: z.string().nullable(),
        ref: z.string().nullable(),
        role: z.object({
            id: z.number().nullable(),
            resourceType: z.literal("Role"),
        }),
        status: D4HMemberStatus.schema,
    }),
} as const;

export type D4HMember = z.infer<typeof D4HMember.schema>;
