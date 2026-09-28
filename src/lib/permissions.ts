/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, memberAc } from "better-auth/plugins/organization/access";
import * as z from "zod";

const statement = {
    ...defaultStatements,
    d4hEquipment: ["view"],
    i3Item: ["view", "issue", "inspect", "return"],
    i3Template: ["view", "create", "update", "delete"],
    invitation: ["view", "create", "update", "cancel"],
    member: ["view", "create", "update", "delete", "owner"],
    organization: ["view", "update", "delete"],
    person: ["view", "create", "update", "delete"],
    skillPackageSubscription: ["view", "subscribe"],
    skillCheck: ["view", "create", "delete"],
    skillCheckSession: ["view", "create", "update", "delete", "approve"],
    skillPackage: ["view", "create", "update", "delete", "publish"],
    team: ["view", "create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const Roles = {
    // Owner: full admin CRUD plus the ability to grant/revoke ownership itself.
    owner: ac.newRole({
        member: ["view", "create", "update", "delete", "owner"],
        invitation: ["view", "create", "update", "cancel"],
        organization: ["view", "update", "delete"],
        person: ["view", "create", "update", "delete"],
        team: ["view", "create", "update", "delete"],
        skillPackageSubscription: ["view"],
    }),
    // Admin: same admin CRUD as owner, but cannot delete the organization or grant/revoke
    // ownership.
    admin: ac.newRole({
        member: ["view", "create", "update", "delete"],
        invitation: ["view", "create", "update", "cancel"],
        organization: ["view", "update"],
        person: ["view", "create", "update", "delete"],
        team: ["view", "create", "update", "delete"],
        skillPackageSubscription: ["view"],
    }),
    member: ac.newRole({
        ...memberAc.statements,
        d4hEquipment: ["view"],
        organization: ["view"],
        person: ["view"],
        skillPackageSubscription: ["view"],
        team: ["view"],
    }),
    "i3-editor": ac.newRole({
        d4hEquipment: ["view"],
        i3Item: ["view", "issue", "inspect", "return"],
        i3Template: ["view"],
        // Paired with `person: ["view"]` — the user↔person link procedures require both.
        member: ["view"],
        organization: ["view"],
        person: ["view"],
    }),
    "skills-assessor": ac.newRole({
        organization: ["view"],
        skillPackageSubscription: ["view"],
        // Recording a check — in a session or standalone — means picking the assessee and
        // assessor from the org's personnel, so an assessor needs to read personnel records.
        person: ["view"],
        team: ["view"],
        skillCheck: ["view", "create"],
        skillCheckSession: ["view", "create", "update"],
    }),
    // Administers the assessment workflow (approves/cleans up sessions, deletes erroneous
    // checks) — does not itself create/assess checks. Only role with `subscribe`.
    "skills-admin": ac.newRole({
        organization: ["view"],
        skillPackageSubscription: ["view", "subscribe"],
        skillCheckSession: ["view", "create", "update", "delete", "approve"],
        skillCheck: ["view", "delete"],
    }),
    // Creates and publishes skill packages (assessment templates) for the org to subscribe
    // to — not to be confused with performing assessments.
    "skills-author": ac.newRole({
        // `organizationProcedure` forces `organization: ["view"]` into every requirement, and
        // the org layout gates on it too — without this the role cannot reach anything.
        organization: ["view"],
        skillPackage: ["view", "create", "update", "delete", "publish"],
    }),
    // Pure read-only reporting surface.
    "skills-reporter": ac.newRole({
        organization: ["view"],
        skillCheck: ["view"],
        skillCheckSession: ["view"],
        skillPackageSubscription: ["view"],
        person: ["view"],
        team: ["view"],
    }),
} as const;

export type Permissions = {
    [K in keyof typeof statement]?: (typeof statement)[K][number][];
};

export type Role = keyof typeof Roles;

export const roles = Object.keys(Roles) as Role[];

/**
 * Validates a single stored role against the full authorization set — unlike
 * `OrganizationRole.schema` (`src/lib/schemas/organization-role.ts`, the user-assignable role
 * set offered by the role pickers), this includes `owner`, which is granted/revoked separately
 * from the rest (see `makeOwner`/`removeOwner`) but still has to authorize as a role.
 */
export const roleSchema = z.enum(roles as [Role, ...Role[]]);

/**
 * The recognised roles in a stored (comma-joined) `OrganizationUser.role` value, for
 * authorization purposes. Unknown entries (whitespace, a retired role) are dropped so this
 * can't throw on a stale or malformed value.
 */
export function parseStoredRoles(stored: string): Role[] {
    return stored.split(",").flatMap((value) => {
        const parsed = roleSchema.safeParse(value.trim());
        return parsed.success ? [parsed.data] : [];
    });
}

/**
 * Whether any of the given roles authorizes every one of `requiredPermissions`.
 *
 * Mirrors `useHasPermission`'s client-side union of roles and Better Auth's own
 * `hasPermissionFn` semantics (granted if a single role authorises the full request) — that
 * agreement is what makes evaluating locally, against a role lookup already in hand, a safe
 * substitute for a second `auth.api.hasPermission` round trip. Used by `createTrpcContext` and
 * `requireOrganizationWith`.
 */
export function hasAnyRoleWithPermissions(
    roles: Role[],
    requiredPermissions: Permissions,
): boolean {
    return roles.some((role) => Roles[role].authorize(requiredPermissions).success);
}
