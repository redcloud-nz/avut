/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { Team as TeamRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { propertiesSchema, tagsSchema, zodNanoId16 } from "../validation";

export const TeamId = {
    schema: zodNanoId16("TeamId expected").brand<"TeamId">(),

    create: (): TeamId => TeamId.schema.parse(nanoId16()),
};

export type TeamId = string & z.BRAND<"TeamId">;

const teamSchema = z.object({
    id: TeamId.schema,
    name: z.string().min(3).max(100),
    description: z.string().max(500),
    tags: tagsSchema,
    properties: propertiesSchema,
    organizationId: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime().nullable(),
});

export const TeamData = {
    schema: teamSchema,

    modifiableSchema: teamSchema.pick({
        name: true,
        description: true,
        tags: true,
        properties: true,
    }),

    fromRecord: (record: TeamRecord): TeamData =>
        teamSchema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt?.toISOString() ?? null,
        }),
} as const;

export type TeamData = z.infer<typeof teamSchema>;
