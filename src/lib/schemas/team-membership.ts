/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { TeamMembership as TeamMembershipRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { propertiesSchema, tagsSchema, zodNanoId16 } from "../validation";
import { TeamId } from "./team";
import { PersonId } from "./person";

export const TeamMembershipId = {
    schema: zodNanoId16(
        "TeamMembershipId expected",
    ).brand<"TeamMembershipId">(),

    create: (): TeamMembershipId => TeamMembershipId.schema.parse(nanoId16()),
};

export type TeamMembershipId = string & z.BRAND<"TeamMembershipId">;

const teamMembershipSchema = z.object({
    id: TeamMembershipId.schema,
    teamId: TeamId.schema,
    personId: PersonId.schema,
    tags: tagsSchema,
    properties: propertiesSchema,
    organizationId: z.string(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export const TeamMembershipData = {
    schema: teamMembershipSchema,

    fromRecord: (record: TeamMembershipRecord): TeamMembershipData =>
        teamMembershipSchema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        }),
} as const;

export type TeamMembershipData = z.infer<typeof teamMembershipSchema>;
