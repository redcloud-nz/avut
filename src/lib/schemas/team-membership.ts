/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TeamMembership as TeamMembershipRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { propertiesSchema, tagsSchema, zodNanoId16 } from "../validation";

import { OrganizationId } from "./organization";
import { PersonId } from "./person";
import { TeamId } from "./team";

export const TeamMembershipId = {
    schema: zodNanoId16(
        "TeamMembershipId expected",
    ).brand<"TeamMembershipId">(),

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
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export const TeamMembershipData = {
    schema: teamMembershipSchema,

    modifiableSchema: teamMembershipSchema.pick({
        tags: true,
        properties: true,
    }),

    fromRecord: (record: TeamMembershipRecord): TeamMembershipData =>
        teamMembershipSchema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        }),
} as const;

export type TeamMembershipData = z.infer<typeof teamMembershipSchema>;

export type ModifiableTeamMembershipData = z.infer<
    typeof TeamMembershipData.modifiableSchema
>;
