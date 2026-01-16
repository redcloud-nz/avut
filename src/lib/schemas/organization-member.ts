/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import type { OrganizationMember as OrganizationMemberRecord } from "@/generated/prisma/client";

import { nanoId16 } from "@/lib/id";
import { OrganizationRole } from "./organization-role";

import { zodNanoId16 } from "../validation";
import { UserId } from "./user";

export const OrganizationMemberId = {
    schema: zodNanoId16(
        "OrganizationMemberId expected",
    ).brand<"OrganizationMemberId">(),

    create: () => OrganizationMemberId.schema.parse(nanoId16()),
} as const;

export type OrganizationMemberId = z.infer<typeof OrganizationMemberId.schema>;

export const OrganizationMemberData = {
    schema: z.object({
        id: OrganizationMemberId.schema,
        organizationId: z.string(),
        createdAt: z.iso.datetime(),
        role: z.array(OrganizationRole.schema),
        userId: UserId.schema,
    }),

    fromRecord: (record: OrganizationMemberRecord) =>
        OrganizationMemberData.schema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
            role: record.role.split(","),
        }),
};

export type OrganizationMemberData = z.infer<
    typeof OrganizationMemberData.schema
>;
