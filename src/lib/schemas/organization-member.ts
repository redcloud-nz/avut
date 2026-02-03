/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import type { OrganizationUser as OrganizationUserRecord } from "@/generated/prisma/client";

import { nanoId16 } from "@/lib/id";
import { OrganizationRole } from "./organization-role";

import { zodNanoId16 } from "../validation";
import { UserId } from "./user";

export const OrganizationUserId = {
    schema: zodNanoId16(
        "OrganizationUserId expected",
    ).brand<"OrganizationUserId">(),

    create: () => OrganizationUserId.schema.parse(nanoId16()),
} as const;

export type OrganizationUserId = z.infer<typeof OrganizationUserId.schema>;

export const OrganizationUserData = {
    schema: z.object({
        id: OrganizationUserId.schema,
        organizationId: z.string(),
        createdAt: z.iso.datetime(),
        role: z.array(OrganizationRole.schema),
        userId: UserId.schema,
    }),

    fromRecord: (record: OrganizationUserRecord) =>
        OrganizationUserData.schema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
            role: record.role.split(","),
        }),
};

export type OrganizationUserData = z.infer<typeof OrganizationUserData.schema>;
