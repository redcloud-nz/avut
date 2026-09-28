/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { D4HServerCode } from "@/lib/d4h-servers";
import { nanoId16 } from "@/lib/id";
import { zodNanoId16 } from "@/lib/validation";

import type { ProviderCredentialRecord } from "./provider-credential";

export const D4HAccessTokenId = {
    schema: zodNanoId16("D4HAccessTokenId expected").brand<"D4HAccessTokenId">(),

    create: () => D4HAccessTokenId.schema.parse(nanoId16()),
} as const;

export type D4HAccessTokenId = z.infer<typeof D4HAccessTokenId.schema>;

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
    d4HOrganisations: z.array(
        z.object({
            id: z.number(),
            title: z.string(),
            resourceType: z.literal("Organisation"),
        }),
    ),
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
 * per the discriminated union in `provider-credential.ts`. Only used to pull `serverCode` and the
 * team/org lists back out of a raw `ProviderCredentialRecord`'s `metadata` JSON below.
 */
export const D4HProviderMetadata = {
    schema: metadataSchema.extend({
        provider: z.literal("D4H"),
        serverCode: D4HServerCode.schema,
    }),
} as const;

export type D4HProviderMetadata = z.infer<typeof D4HProviderMetadata.schema>;

/**
 * D4H's own view of a `ProviderCredential` row — same shape this codebase used before D4H moved
 * onto the generic table (#286 Phase 2), with `serverCode` back at the top level instead of nested
 * in `metadata`. Every existing D4H page/consumer keeps working against this unchanged shape.
 */
export const D4HAccessToken = {
    schema: z.object({
        id: D4HAccessTokenId.schema,
        organizationId: z.string().nullable(),
        userId: z.string().nullable(),
        label: z.string(),
        serverCode: D4HServerCode.schema,
        status: z.string(),
        expiresAt: z.string(),
        createdAt: z.string(),
        metadata: D4HAccessTokenMetadata.schema,
    }),

    fromRecord: (record: ProviderCredentialRecord) => {
        const { serverCode, d4HTeams, d4HOrganisations } = D4HProviderMetadata.schema.parse(
            record.metadata,
        );

        return D4HAccessToken.schema.parse({
            ...record,
            serverCode,
            expiresAt: record.expiresAt.toISOString(),
            createdAt: record.createdAt.toISOString(),
            metadata: { d4HTeams, d4HOrganisations },
        });
    },
} as const;

export type D4HAccessToken = z.infer<typeof D4HAccessToken.schema>;

export const D4HAccessToken_ServerOnly = {
    schema: z.object({
        id: D4HAccessTokenId.schema,
        organizationId: z.string().nullable(),
        userId: z.string().nullable(),
        label: z.string(),
        serverCode: D4HServerCode.schema,
        token: z.string(),
        metadata: D4HAccessTokenMetadata.schema,
    }),
};

export type D4HAccessToken_ServerOnly = z.infer<typeof D4HAccessToken_ServerOnly.schema>;
