/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { ProviderCredential as ProviderCredentialRecord } from "@/generated/prisma/client";
import { nanoId16 } from "@/lib/id";
import { zodNanoId16 } from "@/lib/validation";

import { D4HProviderMetadata } from "./d4h-provider-metadata";

export type { ProviderCredentialRecord };

export const ProviderCredentialId = {
    schema: zodNanoId16("ProviderCredentialId expected").brand<"ProviderCredentialId">(),

    create: () => ProviderCredentialId.schema.parse(nanoId16()),
} as const;

export type ProviderCredentialId = z.infer<typeof ProviderCredentialId.schema>;

export const Provider = {
    schema: z.enum(["D4H"] as const),
} as const;

export type Provider = z.infer<typeof Provider.schema>;

/**
 * Provider-specific metadata, discriminated on `provider`. Each provider gets its own union
 * member here rather than every call site casting an untyped `Json` bag by hand.
 */
// Each provider's member is defined beside that provider's own schemas, so the two can't drift.
const providerCredentialMetadataSchema = z.discriminatedUnion("provider", [
    D4HProviderMetadata.schema,
]);

export const ProviderCredentialMetadata = {
    schema: providerCredentialMetadataSchema,
};

export type ProviderCredentialMetadata = z.infer<typeof ProviderCredentialMetadata.schema>;

/**
 * The generic client-safe shape of a credential, for the next provider to read through. D4H
 * doesn't use it: it reads rows through `D4HAccessToken.fromRecord`, which keeps D4H's own shape.
 */
export const ProviderCredential = {
    schema: z.object({
        id: ProviderCredentialId.schema,
        provider: Provider.schema,
        organizationId: z.string().nullable(),
        userId: z.string().nullable(),
        groupId: z.string().nullable(),
        label: z.string(),
        status: z.string(),
        expiresAt: z.string(),
        createdAt: z.string(),
        metadata: ProviderCredentialMetadata.schema,
    }),

    /** Drops the encrypted `token` explicitly rather than relying on `z.object` stripping unknown
     * keys, so it can't reach the client if the schema is ever loosened. */
    fromRecord: ({ token: _token, ...record }: ProviderCredentialRecord) =>
        ProviderCredential.schema.parse({
            ...record,
            expiresAt: record.expiresAt.toISOString(),
            createdAt: record.createdAt.toISOString(),
        }),
} as const;

export type ProviderCredential = z.infer<typeof ProviderCredential.schema>;

export const ProviderCredential_ServerOnly = {
    schema: z.object({
        id: ProviderCredentialId.schema,
        provider: Provider.schema,
        organizationId: z.string().nullable(),
        userId: z.string().nullable(),
        groupId: z.string().nullable(),
        label: z.string(),
        token: z.string(),
        metadata: ProviderCredentialMetadata.schema,
    }),
};

export type ProviderCredential_ServerOnly = z.infer<typeof ProviderCredential_ServerOnly.schema>;
