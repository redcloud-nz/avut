/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

const organizationRoleSchema = z.enum([
    "owner",
    "admin",
    "member",
    "i3-admin",
    "i3-user",
    "skills-admin",
    "skills-assessor",
    "skill-package-author",
]);

export const OrganizationRole = {
    schema: organizationRoleSchema,

    displayNames: {
        owner: "Owner",
        admin: "Admin",
        member: "Member",
        "i3-admin": "I3 Admin",
        "i3-user": "I3 User",
        "skills-admin": "Skills Admin",
        "skills-assessor": "Skills Assessor",
        "skill-package-author": "Skill Package Author",
    } satisfies Record<OrganizationRole, string>,

    options: [
        { value: "owner", label: "Owner", isAdminAssignable: false },
        { value: "admin", label: "Admin", isAdminAssignable: true },
        { value: "member", label: "Member", isAdminAssignable: true },
    ] as const,

    formatList(roles: OrganizationRole[]) {
        return roles.map((role) => this.displayNames[role]).join(", ");
    },
} as const;

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
