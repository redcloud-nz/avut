/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { D4HServerCode } from "@/lib/d4h-servers";

import { D4HAccessTokenMetadata, D4HProviderMetadata } from "./d4h-provider-metadata";
import { ProviderCredentialId, type ProviderCredentialRecord } from "./provider-credential";

/**
 * D4H's own view of a `ProviderCredential` row — same shape this codebase used before D4H moved
 * onto the generic table (#286 Phase 2), with `serverCode` back at the top level instead of nested
 * in `metadata`. Every existing D4H page/consumer keeps working against this unchanged shape.
 */
export const D4HAccessToken = {
    schema: z.object({
        id: ProviderCredentialId.schema,
        organizationId: z.string().nullable(),
        userId: z.string().nullable(),
        label: z.string(),
        serverCode: D4HServerCode.schema,
        status: z.string(),
        expiresAt: z.string(),
        createdAt: z.string(),
        metadata: D4HAccessTokenMetadata.schema,
    }),

    /** Drops the encrypted `token` explicitly rather than relying on `z.object` stripping unknown
     * keys, so it can't reach the client if the schema is ever loosened. */
    fromRecord: ({ token: _token, ...record }: ProviderCredentialRecord) => {
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
        id: ProviderCredentialId.schema,
        organizationId: z.string().nullable(),
        userId: z.string().nullable(),
        label: z.string(),
        serverCode: D4HServerCode.schema,
        token: z.string(),
        metadata: D4HAccessTokenMetadata.schema,
    }),
};

export type D4HAccessToken_ServerOnly = z.infer<typeof D4HAccessToken_ServerOnly.schema>;
