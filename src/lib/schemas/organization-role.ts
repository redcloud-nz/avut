/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { Modules, type OrganizationModuleId } from "@/lib/modules";
import { roleCovers, type Role } from "@/lib/permissions";

/**
 * Module ids that can actually gate a role. Excludes `org-admin` — it's `alwaysOn` and has no
 * `OrganizationSettings.modules` entry of its own, so it could never be the `moduleId` a role
 * picker checks against.
 */
type RoleGatingModuleId = Exclude<OrganizationModuleId, "org-admin">;

// Display order: grouped by module (see `OrganizationRole.groups`), each module's admin role
// first.
const organizationRoleSchema = z.enum([
    "admin",
    "member",
    "i3-admin",
    "i3-editor",
    "skills-admin",
    "skills-assessor",
    "skills-reporter",
    "skills-author",
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
            "Everything a Member can do, plus full access to organisation settings, users and roster management. Can manage users and roles.",
        isAdminAssignable: true,
    },
    member: {
        displayName: "Member",
        description: "Can view and interact with organisation resources.",
        isAdminAssignable: true,
    },
    "i3-admin": {
        displayName: "I3 Admin",
        description:
            "Everything an I3 Editor can do, plus managing I3 templates — creating, editing and deleting them, including trash/restore/purge.",
        isAdminAssignable: true,
        moduleId: "i3",
    },
    "i3-editor": {
        displayName: "I3 Editor",
        description: "Can edit I3 content within the organisation.",
        isAdminAssignable: true,
        moduleId: "i3",
    },
    "skills-admin": {
        displayName: "Skills Admin",
        description:
            "Everything a Skills Assessor and Skills Reporter can do, plus approving and managing skill check sessions org-wide and deleting erroneous checks and sessions.",
        isAdminAssignable: true,
        moduleId: "skill-track",
    },
    "skills-assessor": {
        displayName: "Skills Assessor",
        description: "Can record and manage skill checks and skill check sessions.",
        isAdminAssignable: true,
        moduleId: "skill-track",
    },
    "skills-reporter": {
        displayName: "Skills Reporter",
        description: "Read-only access to skill check and skill check session reporting.",
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

/**
 * A titled set of roles a role picker shows together: the always-available roles under
 * "Organisation", then one group per module, in role order.
 */
export interface OrganizationRoleGroup {
    title: string;
    moduleId?: RoleGatingModuleId;
    roles: OrganizationRole[];
}

function roleGroups(): OrganizationRoleGroup[] {
    const groups: OrganizationRoleGroup[] = [];
    for (const [role, info] of Object.entries(organizationRoles) as [
        OrganizationRole,
        OrganizationRoleInfo,
    ][]) {
        const group = groups.find((g) => g.moduleId === info.moduleId);
        if (group) group.roles.push(role);
        else
            groups.push({
                title: info.moduleId ? Modules[info.moduleId].label : "Organisation",
                moduleId: info.moduleId,
                roles: [role],
            });
    }
    return groups;
}

const roleSetSchema = z
    .array(organizationRoleSchema)
    .refine((roles) => new Set(roles).size === roles.length, "Roles must not repeat.");

export const OrganizationRole = {
    schema: organizationRoleSchema,

    groups: roleGroups(),

    /**
     * Display names for every role a stored membership can hold — the assignable roles plus
     * `owner`, which no picker offers (see `makeOwner`/`removeOwner`) but which still has to
     * read as "Owner" wherever a member's roles are listed.
     */
    displayNames: {
        owner: "Owner",
        ...Object.fromEntries(
            Object.entries(organizationRoles).map(([role, info]) => [role, info.displayName]),
        ),
    } as Record<Role, string>,

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
     * A member's non-owner roles with no repeats, possibly none — the shape an owner's role set
     * takes, since `owner` alone is a valid membership. `owner` is handled entirely outside this
     * schema (see `makeOwner`/`removeOwner`).
     */
    roleSetSchema,

    /**
     * A member's complete role set as submitted from a form: at least one role, no repeats.
     * `owner` is handled entirely outside this schema (see `makeOwner`/`removeOwner`).
     * Membership rows store this comma-joined — see `serialize`.
     */
    assignmentSchema: roleSetSchema.refine(
        (roles) => roles.length > 0,
        "Choose at least one role.",
    ),

    /**
     * The non-owner roles a role form starts from for a stored (comma-joined)
     * `OrganizationUser.role` value: `parseStored`, less any role another stored non-owner role
     * already covers. The picker shows those covered and locked, so leaving them in the value
     * would keep a redundant role no one could untick. A role only `owner` covers is kept: it's
     * what the member falls back to if their ownership is removed (`removeOwner`).
     */
    formDefaults(stored: string): OrganizationRole[] {
        const roles = OrganizationRole.parseStored(stored);
        return roles.filter(
            (role) => !roles.some((other) => other !== role && roleCovers(other, role)),
        );
    },

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
    formatList(roles: Role[] | string) {
        const list = typeof roles === "string" ? roles.split(",").map((r) => r.trim()) : roles;
        return list
            .map((role) => (this.displayNames as Record<string, string>)[role] ?? role)
            .join(", ");
    },
} as const;

export type OrganizationRole = z.infer<typeof organizationRoleSchema>;
