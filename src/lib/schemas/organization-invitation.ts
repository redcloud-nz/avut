/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { OrganizationInvitation as InvitationRecord } from "@/generated/prisma/client";
import { nanoId16 } from "@/lib/id";
import { zodNanoId16 } from "@/lib/validation";

import { OrganizationId } from "./organization";
import { OrganizationRole } from "./organization-role";
import { PersonId } from "./person";
import { UserId } from "./user";

export const InvitationId = {
    schema: zodNanoId16("InvitationId expected").brand<"InvitationId">(),

    create: () => InvitationId.schema.parse(nanoId16()),
} as const;

export type InvitationId = z.infer<typeof InvitationId.schema>;

export const OrganizationInvitationData = {
    schema: z.object({
        id: InvitationId.schema,
        organizationId: OrganizationId.schema,
        personId: PersonId.schema.nullable(),
        email: z.email(),
        roles: z.array(OrganizationRole.schema),
        status: z.string(),
        inviterId: UserId.schema,
        createdAt: z.iso.datetime(),
        expiresAt: z.iso.datetime(),
        teamId: z.string().nullable(),
    }),

    fromRecord: (record: InvitationRecord) =>
        OrganizationInvitationData.schema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
            expiresAt: record.expiresAt.toISOString(),
            roles: record.role?.split(",") ?? [],
            teamId: record.teamId ?? null,
        }),
};

export type OrganizationInvitationData = z.infer<typeof OrganizationInvitationData.schema>;
