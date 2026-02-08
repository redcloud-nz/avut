/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { D4hAccessToken as D4hAccessTokenRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";
import { D4HServerCode } from "../d4h-api/servers";

export const D4hAccessTokenId = {
    schema: zodNanoId16(
        "D4hAccessTokenId expected",
    ).brand<"D4hAccessTokenId">(),

    create: () => D4hAccessTokenId.schema.parse(nanoId16()),
} as const;

export type D4hAccessTokenId = z.infer<typeof D4hAccessTokenId.schema>;

export const D4hAccessTokenData = {
    schema: z.object({
        id: D4hAccessTokenId.schema,
        organizationId: z.string().nullable(),
        userId: z.string().nullable(),
        label: z.string(),
        serverCode: D4HServerCode.schema,
        token: z.string(),
        status: z.string(),
        expiresAt: z.string(),
        createdAt: z.string(),
        metadata: z.record(z.string(), z.any()),
    }),

    fromRecord: (record: D4hAccessTokenRecord) =>
        D4hAccessTokenData.schema.parse({
            ...record,
            expiresAt: record.expiresAt.toISOString(),
            createdAt: record.createdAt.toISOString(),
        }),
} as const;

export type D4hAccessTokenData = z.infer<typeof D4hAccessTokenData.schema>;
