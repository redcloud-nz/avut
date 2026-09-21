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
            "Has full access to all organisation settings and data. Can even delete the organisation. This role is not assignable by admins.",
        isAdminAssignable: false,
        isPrimary: true,
    },
    admin: {
        displayName: "Admin",
        description:
            "Has full access to all organisation settings and data. Can manage users and roles.",
        isAdminAssignable: true,
        isPrimary: true,
    },
    member: {
        displayName: "Member",
        description: "Can view and interact with organisation resources.",
        isAdminAssignable: true,
        isPrimary: true,
    },
    "i3-editor": {
        displayName: "I3 Editor",
        description: "Can edit I3 content within the organisation.",
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

    /**
     * A member's complete role set as submitted from a form: exactly one primary role plus any
     * secondary roles, no repeats. Membership rows store this comma-joined — see `serialize`.
     */
    assignmentSchema: z
        .array(organizationRoleSchema)
        .refine((roles) => new Set(roles).size === roles.length, "Roles must not repeat.")
        .refine(
            (roles) => roles.filter((role) => organizationRoles[role].isPrimary).length === 1,
            "Choose exactly one primary role (owner, admin or member).",
        ),

    /** The stored `OrganizationUser.role` value for a role set: comma-joined, primary role first. */
    serialize(roles: OrganizationRole[]): string {
        return [...roles]
            .sort(
                (a, b) =>
                    Number(organizationRoles[b].isPrimary) - Number(organizationRoles[a].isPrimary),
            )
            .join(",");
    },

    /** Whether a stored (comma-joined) `OrganizationUser.role` value includes `role`. */
    includes(stored: string, role: OrganizationRole): boolean {
        return stored.split(",").includes(role);
    },

    /**
     * The recognised roles in a stored (comma-joined) `OrganizationUser.role` value. Unknown
     * entries (whitespace, a retired role) are dropped so display code can't crash on them.
     */
    parseStored(stored: string): OrganizationRole[] {
        return stored.split(",").flatMap((value) => {
            const parsed = organizationRoleSchema.safeParse(value.trim());
            return parsed.success ? [parsed.data] : [];
        });
    },

    /** Display names for a role list; an unrecognised stored role is shown as-is. */
    formatList(roles: OrganizationRole[] | string) {
        const list = typeof roles === "string" ? roles.split(",").map((r) => r.trim()) : roles;
        return list
            .map((role) => (this.displayNames as Record<string, string>)[role] ?? role)
            .join(", ");
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
