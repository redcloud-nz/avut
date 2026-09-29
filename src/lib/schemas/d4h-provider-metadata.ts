/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { D4HServerCode } from "@/lib/d4h-servers";

// A leaf both `provider-credential.ts` and `d4h-access-token.ts` import, so neither imports the
// other's values: each evaluates a schema from the other at module load.

export const D4HTeamPermissions = {
    schema: z.record(z.string(), z.record(z.string(), z.boolean())),
} as const;

export type D4HTeamPermissions = z.infer<typeof D4HTeamPermissions.schema>;

const metadataSchema = z.object({
    d4HTeams: z.array(
        z.object({
            id: z.number(),
            title: z.string(),
            resourceType: z.literal("Team"),
            owner: z
                .object({
                    id: z.number(),
                    resourceType: z.literal("Organisation"),
                    title: z.string(),
                })
                .optional(),
            permissions: D4HTeamPermissions.schema,
        }),
    ),
    // Defaulted because a since-fixed misspelling (`d4HOrganizations`) once wrote rows without
    // this field, and reading one back crashed the whole token list (#171).
    d4HOrganisations: z
        .array(
            z.object({
                id: z.number(),
                title: z.string(),
                resourceType: z.literal("Organisation"),
            }),
        )
        .default([]),
});

export const D4HAccessTokenMetadata = {
    schema: metadataSchema,

    empty: metadataSchema.parse({
        d4HTeams: [],
        d4HOrganisations: [],
    }),
};

export type D4HAccessTokenMetadata = z.infer<typeof D4HAccessTokenMetadata.schema>;

/**
 * D4H's slice of `ProviderCredential.metadata` — `{ provider: "D4H", serverCode, ...D4HAccessTokenMetadata }`,
 * the D4H member of the discriminated union in `provider-credential.ts`, and what
 * `D4HAccessToken.fromRecord` parses a raw record's `metadata` JSON with.
 */
export const D4HProviderMetadata = {
    schema: metadataSchema.extend({
        provider: z.literal("D4H"),
        serverCode: D4HServerCode.schema,
    }),
} as const;

export type D4HProviderMetadata = z.infer<typeof D4HProviderMetadata.schema>;
