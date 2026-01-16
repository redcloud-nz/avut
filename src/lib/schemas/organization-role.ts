/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

const organizationRoleSchema = z.enum(["owner", "admin", "member"]);

export const OrganizationRole = {
    schema: organizationRoleSchema,

    displayNames: {
        owner: "Owner",
        admin: "Admin",
        member: "Member",
    } satisfies Record<OrganizationRole, string>,

    options: [
        { value: "owner", label: "Owner", isAdminAssignable: false },
        { value: "admin", label: "Admin", isAdminAssignable: true },
        { value: "member", label: "Member", isAdminAssignable: true },
    ] as const,
} as const;

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
