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
    // Granting and revoking one role on an existing member, independently of the rest of their
    // role set — each action is the role it hands out. A role may only hold a `roleGrant` for a
    // role it covers (`roleCovers`), so granting can never hand out more than the granter holds;
    // `member: ["update"]` (the full role editor) is the one exception. Only the roles delegated
    // so far are listed; add one here to let its module admin hand it out.
    roleGrant: ["skills-assessor"],
    skillPackageSubscription: ["view", "subscribe"],
    skillCheck: ["view", "create", "delete"],
    skillCheckSession: ["view", "create", "update", "delete", "approve"],
    skillPackage: ["view", "create", "update", "delete", "publish"],
    team: ["view", "create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const Roles = {
    // Owner: everything `admin` can do, plus deleting the org and granting/revoking ownership
    // itself.
    owner: ac.newRole({
        ...memberAc.statements,
        d4hEquipment: ["view"],
        member: ["view", "create", "update", "delete", "owner"],
        invitation: ["view", "create", "update", "cancel"],
        organization: ["view", "update", "delete"],
        person: ["view", "create", "update", "delete"],
        team: ["view", "create", "update", "delete"],
        roleGrant: ["skills-assessor"],
        skillPackageSubscription: ["view"],
    }),
    // Admin: everything `member` can do, plus admin CRUD — but cannot delete the organization
    // or grant/revoke ownership.
    admin: ac.newRole({
        ...memberAc.statements,
        d4hEquipment: ["view"],
        member: ["view", "create", "update", "delete"],
        invitation: ["view", "create", "update", "cancel"],
        organization: ["view", "update"],
        person: ["view", "create", "update", "delete"],
        team: ["view", "create", "update", "delete"],
        roleGrant: ["skills-assessor"],
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
    // The I3 module's admin role: everything `i3-editor` can do, plus managing I3 templates —
    // creation, editing and deletion (incl. trash/restore/purge).
    "i3-admin": ac.newRole({
        d4hEquipment: ["view"],
        i3Item: ["view", "issue", "inspect", "return"],
        i3Template: ["view", "create", "update", "delete"],
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
    // The Skill Track module's admin role: everything `skills-assessor` and `skills-reporter`
    // can do, plus administering the assessment workflow (approves/cleans up sessions, deletes
    // erroneous checks). Only role with `subscribe`.
    "skills-admin": ac.newRole({
        organization: ["view"],
        person: ["view"],
        team: ["view"],
        roleGrant: ["skills-assessor"],
        skillPackageSubscription: ["view", "subscribe"],
        skillCheckSession: ["view", "create", "update", "delete", "approve"],
        skillCheck: ["view", "create", "delete"],
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

/** A role that can be granted on its own through `roleGrant` — see the statement above. */
export const grantableRoleSchema = z.enum(statement.roleGrant);

export type GrantableRole = z.infer<typeof grantableRoleSchema>;

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

/** Whether a stored (comma-joined) `OrganizationUser.role` value includes `owner`. */
export function hasOwnerRole(stored: string): boolean {
    return parseStoredRoles(stored).includes("owner");
}

/**
 * Whether `role` grants everything `other` does — holding both is then no different from
 * holding `role` alone. A role covers itself. Compared statement by statement rather than
 * through `authorize`, which treats an empty action list as unauthorized.
 */
export function roleCovers(role: Role, other: Role): boolean {
    const granted: Partial<Record<string, readonly string[]>> = Roles[role].statements;
    return Object.entries(
        Roles[other].statements as Partial<Record<string, readonly string[]>>,
    ).every(([resource, actions = []]) =>
        actions.every((action) => granted[resource]?.includes(action)),
    );
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
