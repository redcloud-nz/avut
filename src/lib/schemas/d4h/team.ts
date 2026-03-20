/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

export const D4HTeam = {
    schema: z.object({
        id: z.number(),
        resourceType: z.literal("Team"),
        title: z.string(),
        owner: z
            .object({
                id: z.number(),
                resourceType: z.literal("Organisation"),
            })
            .optional(),
    }),
} as const;

export type D4HTeam = z.infer<typeof D4HTeam.schema>;

export const D4HTeamRef = {
    schema: z.object({
        id: z.number(),
        resourceType: z.literal("Team"),
        title: z.string(),
    }),
} as const;

export type D4HTeamRef = z.infer<typeof D4HTeamRef.schema>;
