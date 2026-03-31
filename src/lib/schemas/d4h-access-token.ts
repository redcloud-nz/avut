/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { D4hAccessToken as D4hAccessTokenRecord } from "@/generated/prisma/client";

import { D4HServerCode } from "@/lib/d4h-servers";
import { nanoId16 } from "@/lib/id";
import { zodNanoId16 } from "@/lib/validation";
import { decryptDBValue } from "@/server/encrypt";

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

    fromRecord: (record: D4hAccessTokenRecord) =>
        D4HAccessToken.schema.parse({
            ...record,
            expiresAt: record.expiresAt.toISOString(),
            createdAt: record.createdAt.toISOString(),
        }),
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

    fromRecord: (record: D4hAccessTokenRecord) =>
        D4HAccessToken_ServerOnly.schema.parse({
            ...record,
            token: decryptDBValue(record.token),
        }),
};

export type D4HAccessToken_ServerOnly = z.infer<typeof D4HAccessToken_ServerOnly.schema>;
