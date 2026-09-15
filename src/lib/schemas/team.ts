/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { Team as TeamRecord, Team_D4H as TeamD4HRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { propertiesSchema, tagsSchema, zodNanoId16 } from "../validation";
import { D4HServerCode } from "../d4h-servers";

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

    d4h: z
        .object({
            d4hTeamId: z.number(),
            d4hTeamName: z.string(),
            d4hServerCode: D4HServerCode.schema,
            d4hOrganisationId: z.number().nullable(),
            d4hOrganisationName: z.string().nullable(),
            d4hTimezone: z.string().nullable(),
            lastSyncedAt: z.iso.datetime().nullable(),
        })
        .nullable(),
});

export const TeamData = {
    schema: teamSchema,

    modifiableSchema: teamSchema.pick({
        name: true,
        description: true,
        tags: true,
        properties: true,
    }),

    fromRecord: (
        record: TeamRecord & {
            // `d4hOrganisationName` is resolved from the org's `Organization_D4H`
            // cache and joined on by callers that surface it (e.g. `getTeam`);
            // absent elsewhere, in which case it reads as null.
            d4h: (TeamD4HRecord & { d4hOrganisationName?: string | null }) | null;
        },
    ): TeamData =>
        teamSchema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt?.toISOString() ?? null,
            d4h: record.d4h
                ? {
                      d4hTeamId: record.d4h.d4hTeamId,
                      d4hTeamName: record.d4h.d4hTeamName,
                      d4hServerCode: record.d4h.d4hServerCode,
                      d4hOrganisationId: record.d4h.d4hOrganisationId,
                      d4hOrganisationName: record.d4h.d4hOrganisationName ?? null,
                      d4hTimezone: record.d4h.d4hTimezone,
                      lastSyncedAt: record.d4h.lastSyncedAt?.toISOString() ?? null,
                  }
                : null,
        }),
} as const;

export type TeamData = z.infer<typeof teamSchema>;

export type ModifiableTeamData = z.infer<typeof TeamData.modifiableSchema>;

export const TeamRef = {
    schema: z.object({
        id: TeamId.schema,
        name: z.string(),
    }),
} as const;

export type TeamRef = z.infer<typeof TeamRef.schema>;
