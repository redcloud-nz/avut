/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { ProviderCredential as ProviderCredentialRecord } from "@/generated/prisma/client";
import { D4HServerCode } from "@/lib/d4h-servers";
import { nanoId16 } from "@/lib/id";
import { zodNanoId16 } from "@/lib/validation";

export type { ProviderCredentialRecord };

/** Record<D4H permission group, Record<D4H permission key, granted>> — same shape D4H's whoami response uses. */
const d4hTeamPermissionsSchema = z.record(z.string(), z.record(z.string(), z.boolean()));

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
const providerCredentialMetadataSchema = z.discriminatedUnion("provider", [
    z.object({
        provider: z.literal("D4H"),
        serverCode: D4HServerCode.schema,
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
                permissions: d4hTeamPermissionsSchema,
            }),
        ),
        d4HOrganisations: z.array(
            z.object({
                id: z.number(),
                title: z.string(),
                resourceType: z.literal("Organisation"),
            }),
        ),
    }),
]);

export const ProviderCredentialMetadata = {
    schema: providerCredentialMetadataSchema,
};

export type ProviderCredentialMetadata = z.infer<typeof ProviderCredentialMetadata.schema>;

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
