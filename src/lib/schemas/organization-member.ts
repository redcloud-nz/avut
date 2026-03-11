/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { OrganizationUser as OrganizationUserRecord } from "@/generated/prisma/client";

import { nanoId16 } from "@/lib/id";
import { OrganizationRole } from "./organization-role";

import { zodNanoId16 } from "../validation";
import { UserId } from "./user";

export const OrganizationMembershipId = {
    schema: zodNanoId16(
        "OrganizationMembershipId expected",
    ).brand<"OrganizationMembershipId">(),

    create: () => OrganizationMembershipId.schema.parse(nanoId16()),
} as const;

export type OrganizationMembershipId = z.infer<
    typeof OrganizationMembershipId.schema
>;

export const OrganizationMembershipData = {
    schema: z.object({
        id: OrganizationMembershipId.schema,
        organizationId: z.string(),
        createdAt: z.iso.datetime(),
        role: z.array(OrganizationRole.schema),
        userId: UserId.schema,
    }),

    fromRecord: (record: OrganizationUserRecord) =>
        OrganizationMembershipData.schema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
            role: record.role.split(","),
        }),
};

export type OrganizationMembershipData = z.infer<
    typeof OrganizationMembershipData.schema
>;
