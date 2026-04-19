/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type {
    OrganizationUser as OrganizationUserRecord,
    User as UserRecord,
} from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

import { OrganizationId } from "./organization";
import { OrganizationRole } from "./organization-role";
import { PersonId } from "./person";
import { UserId } from "./user";

export const OrganizationUserId = {
    schema: zodNanoId16("OrganizationUserId expected").brand<"OrganizationUserId">(),

    create: () => OrganizationUserId.schema.parse(nanoId16()),
} as const;

export type OrganizationUserId = z.infer<typeof OrganizationUserId.schema>;

export const OrganizationUser = {
    schema: z.object({
        userId: UserId.schema,
        organizationId: OrganizationId.schema,
        organizationUserId: OrganizationUserId.schema,
        personId: PersonId.schema.nullable(),
        name: z.string(),
        email: z.email(),
        roles: z.array(OrganizationRole.schema),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
    }),

    fromRecord: (userRecord: UserRecord, organizationUserRecord: OrganizationUserRecord) =>
        OrganizationUser.schema.parse({
            userId: userRecord.id,
            organizationId: organizationUserRecord.organizationId,
            organizationUserId: organizationUserRecord.id,
            personId: organizationUserRecord.personId,
            name: userRecord.name,
            email: userRecord.email,
            roles: organizationUserRecord.role.split(","),
            createdAt: organizationUserRecord.createdAt.toISOString(),
            updatedAt: organizationUserRecord.updatedAt.toISOString(),
        }),
} as const;

export type OrganizationUser = z.infer<typeof OrganizationUser.schema>;
