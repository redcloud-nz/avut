/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { OrganizationModuleId } from "@/lib/modules";

/**
 * Module ids that can actually gate a role. Excludes `org-admin` — it's `alwaysOn` and has no
 * `OrganizationSettings.modules` entry of its own, so it could never be the `moduleId` a role
 * picker checks against.
 */
type RoleGatingModuleId = Exclude<OrganizationModuleId, "org-admin">;

const organizationRoleSchema = z.enum([
    "admin",
    "member",
    "i3-editor",
    "i3-admin",
    "skills-assessor",
    "skills-admin",
    "skills-author",
    "skills-reporter",
]);

interface OrganizationRoleInfo {
    displayName: string;
    description?: string;
    isAdminAssignable: boolean;
    /**
     * The organization module that must be enabled for a role picker to offer this role.
     * Omitted for roles that are always available (`admin`, `member`) — the single source of
     * truth for which specialty role belongs to which module, so a picker can never drift out
     * of sync with another (see `OrganizationRole.moduleGatedOptions`).
     */
    moduleId?: RoleGatingModuleId;
}

const organizationRoles = {
    admin: {
        displayName: "Admin",
        description:
            "Has full access to organisation settings, users and roster management. Can manage users and roles.",
        isAdminAssignable: true,
    },
    member: {
        displayName: "Member",
        description: "Can view and interact with organisation resources.",
        isAdminAssignable: true,
    },
    "i3-editor": {
        displayName: "I3 Editor",
        description: "Can edit I3 content within the organisation.",
        isAdminAssignable: true,
        moduleId: "i3",
    },
    "i3-admin": {
        displayName: "I3 Admin",
        description:
            "Manages I3 templates — creating, editing and deleting them, including trash/restore/purge. Not needed for everyday issue/inspect/return work, which is covered by I3 Editor.",
        isAdminAssignable: true,
        moduleId: "i3",
    },
    "skills-assessor": {
        displayName: "Skills Assessor",
        description: "Can record and manage skill checks and skill check sessions.",
        isAdminAssignable: true,
        moduleId: "skill-track",
    },
    "skills-admin": {
        displayName: "Skills Admin",
        description:
            "Approves and manages skill check sessions org-wide; can delete erroneous checks and sessions, but doesn't perform assessments itself.",
        isAdminAssignable: true,
        moduleId: "skill-track",
    },
    "skills-author": {
        displayName: "Skills Author",
        description:
            "Creates and publishes skill packages (assessment templates) for the org to subscribe to — not to be confused with performing assessments.",
        isAdminAssignable: true,
        moduleId: "skill-package-builder",
    },
    "skills-reporter": {
        displayName: "Skills Reporter",
        description: "Read-only access to skill check and skill check session reporting.",
        isAdminAssignable: true,
        moduleId: "skill-track",
    },
} satisfies Record<z.infer<typeof organizationRoleSchema>, OrganizationRoleInfo>;

/**
 * A role offered by a role picker, and whether it's currently available. Roles gated on a
 * module (see `OrganizationRoleInfo.moduleId`) are only `enabled` when that module is; `admin`/
 * `member` are always enabled.
 */
export type ModuleGatedRoleOptions = readonly {
    role: OrganizationRole;
    enabled: boolean;
}[];

export const OrganizationRole = {
    schema: organizationRoleSchema,

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
     * Every role gated on a module (see `moduleId`), resolved against `isModuleEnabled` — the
     * single place a role picker gets its module-gated options from, so every picker (the
     * invitation form, the org-admin edit-roles dialog, the system-admin screens) stays in sync
     * with which specialty role belongs to which module without re-deriving the list itself.
     * `admin`/`member` never appear here — they have no `moduleId` and are always offered.
     */
    moduleGatedOptions(
        isModuleEnabled: (id: RoleGatingModuleId) => boolean,
    ): ModuleGatedRoleOptions {
        return Object.entries(organizationRoles as Record<OrganizationRole, OrganizationRoleInfo>)
            .filter(
                (
                    entry,
                ): entry is [
                    OrganizationRole,
                    OrganizationRoleInfo & { moduleId: RoleGatingModuleId },
                ] => Boolean(entry[1].moduleId),
            )
            .map(([role, info]) => ({ role, enabled: isModuleEnabled(info.moduleId) }));
    },

    /**
     * A member's complete role set as submitted from a form: at least one role, no repeats.
     * `owner` is handled entirely outside this schema (see `makeOwner`/`removeOwner`).
     * Membership rows store this comma-joined — see `serialize`.
     */
    assignmentSchema: z
        .array(organizationRoleSchema)
        .refine((roles) => new Set(roles).size === roles.length, "Roles must not repeat.")
        .refine((roles) => roles.length > 0, "Choose at least one role."),

    /** The stored `OrganizationUser.role` value for a role set: comma-joined. */
    serialize(roles: OrganizationRole[]): string {
        return roles.join(",");
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
} as const;

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
