/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

const organizationRoleSchema = z.enum([
    "owner",
    "admin",
    "member",
    "i3-editor",
    "skills-assessor",
    "skill-package-author",
]);

interface OrganizationRoleInfo {
    displayName: string;
    description?: string;
    isAdminAssignable: boolean;
    isPrimary: boolean;
}

const organizationRoles = {
    owner: {
        displayName: "Owner",
        description:
            "Has full access to all organization settings and data. Can even delete the organization. This role is not assignable by admins.",
        isAdminAssignable: false,
        isPrimary: true,
    },
    admin: {
        displayName: "Admin",
        description:
            "Has full access to all organization settings and data. Can manage users and roles.",
        isAdminAssignable: true,
        isPrimary: true,
    },
    member: {
        displayName: "Member",
        description: "Can view and interact with organization resources.",
        isAdminAssignable: true,
        isPrimary: true,
    },
    "i3-editor": {
        displayName: "I3 Editor",
        description: "Can edit I3 content within the organization.",
        isAdminAssignable: true,
        isPrimary: false,
    },
    "skills-assessor": {
        displayName: "Skills Assessor",
        description: "Can assess skills and provide feedback.",
        isAdminAssignable: true,
        isPrimary: false,
    },
    "skill-package-author": {
        displayName: "Skill Package Author",
        description: "Can create and manage skill packages.",
        isAdminAssignable: true,
        isPrimary: false,
    },
} satisfies Record<z.infer<typeof organizationRoleSchema>, OrganizationRoleInfo>;

export const OrganizationRole = {
    schema: organizationRoleSchema,

    primaryRoleSchema: z.enum(["owner", "admin", "member"]),
    secondaryRoleSchema: z.enum(["i3-editor", "skills-assessor", "skill-package-author"]),

    displayNames: Object.fromEntries(
        Object.entries(organizationRoles).map(([role, info]) => [role, info.displayName]),
    ) as Record<OrganizationRole, string>,

    roles: organizationRoles as Record<OrganizationRole, OrganizationRoleInfo>,

    options: Object.entries(organizationRoles).map(([role, info]) => ({
        value: role,
        label: info.displayName,
    })) as { value: OrganizationRole; label: string }[],

    values: Object.keys(organizationRoles) as OrganizationRole[],

    formatList(roles: OrganizationRole[] | string) {
        if (typeof roles === "string") {
            roles = roles.split(",").map((role) => role.trim()) as OrganizationRole[];
        }
        return roles.map((role) => this.displayNames[role]).join(", ");
    },

    getPrimaryRole(roles: OrganizationRole[]): "owner" | "admin" | "member" {
        const primaryRole = roles.find(
            (role) => role === "owner" || role === "admin" || role === "member",
        );
        if (!primaryRole) throw new Error("No primary role found in roles array");

        return primaryRole;
    },
    getSecondaryRoles(
        roles: OrganizationRole[],
    ): Exclude<OrganizationRole, "owner" | "admin" | "member">[] {
        return roles.filter(
            (role) => role !== "owner" && role !== "admin" && role !== "member",
        ) as Exclude<OrganizationRole, "owner" | "admin" | "member">[];
    },
} as const;

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
