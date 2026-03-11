/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

export const D4HWhoami = {
    schema: z.object({
        account: z.object({
            id: z.number(),
            resourceType: z.literal("Account"),
        }),
        members: z.array(
            z.object({
                id: z.number(),
                resourceType: z.literal("Member"),
                hasAccess: z.boolean(),
                name: z.string(),
                owner: z.object({
                    id: z.number(),
                    resourceType: z.literal("Team"),
                    title: z.string(),
                    owner: z.object({
                        id: z.number(),
                        resourceType: z.literal("Organisation"),
                    }), //.optional(),
                }),
                permissions: z.record(
                    z.string(),
                    z.record(z.string(), z.boolean().optional()).optional(),
                ),
            }),
        ),
    }),
} as const;

export type D4HWhoami = z.infer<typeof D4HWhoami.schema>;
