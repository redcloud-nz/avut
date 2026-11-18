/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { Team_D4H as TeamD4HRecord, Team as TeamRecord } from "@/generated/prisma/client";

import { D4HServerCode } from "../d4h-servers";
import { nanoId16 } from "../id";
import { propertiesSchema, recordStatusSchema, tagsSchema, zodNanoId16 } from "../validation";

export type { TeamD4HRecord };

export const TeamId = {
    schema: zodNanoId16("TeamId expected").brand<"TeamId">(),

    create: (): TeamId => TeamId.schema.parse(nanoId16()),
};

export type TeamId = string & z.BRAND<"TeamId">;

/**
 * Words a team slug can't take, held back for static routes under `/teams/`.
 */
export const TEAM_SLUG_RESERVED = ["admin", "api", "create", "edit", "new", "settings"] as const;

export const TeamSlug = {
    /**
     * Input schema for a team slug: the organization slug rule (2–50 lowercase letters,
     * digits and hyphens), minus the reserved words. Slugs are unique across all orgs.
     */
    schema: z
        .string()
        .min(2)
        .max(50)
        .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only")
        .refine((slug) => !(TEAM_SLUG_RESERVED as readonly string[]).includes(slug), {
            message: "That slug is reserved.",
        }),
} as const;

const teamSchema = z.object({
    id: TeamId.schema,
    name: z.string().min(3).max(100),
    // Read shape: any stored slug, so a word added to `TEAM_SLUG_RESERVED` later can't
    // make existing rows fail to parse. Input is validated by `modifiableSchema`.
    slug: z.string().nullable(),
    description: z.string().max(500),
    tags: tagsSchema,
    properties: propertiesSchema,
    organizationId: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime().nullable(),
    status: recordStatusSchema.default("Active"),

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

    modifiableSchema: teamSchema
        .pick({
            name: true,
            slug: true,
            description: true,
            tags: true,
            properties: true,
        })
        .extend({
            // An empty field clears the slug.
            slug: z.union([z.literal("").transform(() => null), TeamSlug.schema]).nullable(),
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
