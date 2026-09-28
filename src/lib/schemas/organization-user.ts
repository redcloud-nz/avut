/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { OrganizationUser as OrganizationUserRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { parseStoredRoles, roleSchema } from "../permissions";
import { zodNanoId16 } from "../validation";

import { OrganizationId } from "./organization";
import { PersonId } from "./person";
import { UserId } from "./user";

export const OrganizationUserId = {
    schema: zodNanoId16("OrganizationUserId expected").brand<"OrganizationUserId">(),

    create: () => OrganizationUserId.schema.parse(nanoId16()),
} as const;

export type OrganizationUserId = z.infer<typeof OrganizationUserId.schema>;

/**
 * A membership row only. A router that also needs the member's `User` (or the `Organization`)
 * composes it into its own output, e.g. `{ ...OrganizationUser.fromRecord(m), user: UserData.fromRecord(u) }`.
 */
export const OrganizationUser = {
    schema: z.object({
        userId: UserId.schema,
        organizationId: OrganizationId.schema,
        organizationUserId: OrganizationUserId.schema,
        personId: PersonId.schema.nullable(),
        roles: z.array(roleSchema),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
    }),

    /**
     * `roles` is the full authorizing set, `owner` included — unlike `OrganizationRole.schema`,
     * which is only the roles a picker can assign. Unrecognised stored entries are dropped.
     */
    fromRecord: (record: OrganizationUserRecord) =>
        OrganizationUser.schema.parse({
            userId: record.userId,
            organizationId: record.organizationId,
            organizationUserId: record.id,
            personId: record.personId,
            roles: parseStoredRoles(record.role),
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        }),
} as const;

export type OrganizationUser = z.infer<typeof OrganizationUser.schema>;
