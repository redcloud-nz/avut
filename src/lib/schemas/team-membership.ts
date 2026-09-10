/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import {
    TeamMembership as TeamMembershipRecord,
    TeamMembership_D4H as TeamMembershipD4HRecord,
} from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { propertiesSchema, recordStatusSchema, tagsSchema, zodNanoId16 } from "../validation";

import { OrganizationId } from "./organization";
import { PersonId } from "./person";
import { TeamId } from "./team";

export const TeamMembershipId = {
    schema: zodNanoId16("TeamMembershipId expected").brand<"TeamMembershipId">(),

    create: (): TeamMembershipId => TeamMembershipId.schema.parse(nanoId16()),
};

export type TeamMembershipId = string & z.BRAND<"TeamMembershipId">;

const teamMembershipSchema = z.object({
    id: TeamMembershipId.schema,
    organizationId: OrganizationId.schema,
    teamId: TeamId.schema,
    personId: PersonId.schema,
    tags: tagsSchema,
    properties: propertiesSchema,
    status: recordStatusSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),

    d4h: z
        .object({
            d4hMemberId: z.number(),
            d4hStatus: z.string(),
            d4hPosition: z.string().nullable(),
            d4hRef: z.string().nullable(),
            d4hRoleId: z.number().nullable(),
        })
        .nullable(),
});

export const TeamMembershipData = {
    schema: teamMembershipSchema,

    modifiableSchema: teamMembershipSchema.pick({
        tags: true,
        properties: true,
    }),

    fromRecord: (
        record: TeamMembershipRecord & { d4h?: TeamMembershipD4HRecord | null },
    ): TeamMembershipData =>
        teamMembershipSchema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
            d4h: record.d4h
                ? {
                      d4hMemberId: record.d4h.d4hMemberId,
                      d4hStatus: record.d4h.d4hStatus,
                      d4hPosition: record.d4h.d4hPosition,
                      d4hRef: record.d4h.d4hRef,
                      d4hRoleId: record.d4h.d4hRoleId,
                  }
                : null,
        }),
} as const;

export type TeamMembershipData = z.infer<typeof teamMembershipSchema>;

export type ModifiableTeamMembershipData = z.infer<typeof TeamMembershipData.modifiableSchema>;
