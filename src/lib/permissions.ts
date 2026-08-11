/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, memberAc } from "better-auth/plugins/organization/access";

const statement = {
    ...defaultStatements,
    d4hAccessToken: ["view", "create", "update", "delete"],
    d4hEquipment: ["view"],
    i3Item: ["view", "issue", "inspect", "return"],
    i3Template: ["view", "create", "update", "delete"],
    invitation: ["view", "create", "update", "cancel"],
    member: ["view", "create", "update", "delete"],
    organization: ["view", "update", "delete"],
    person: ["view", "create", "update", "delete", "archive", "restore"],
    skillPackageSubscription: ["view", "subscribe"],
    skillCheck: ["view", "create", "update", "delete"],
    skillCheckSession: ["view", "create", "update", "delete"],
    skillPackageBuilder: ["view", "create", "update", "delete", "publish"],
    team: ["view", "create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

/**
 * Every action of every resource in `statement`. Derived once so the "god"
 * roles can never drift from the matrix as resources are added.
 */
const all = Object.fromEntries(
    Object.entries(statement).map(([resource, actions]) => [resource, [...actions]]),
) as { [K in keyof typeof statement]: (typeof statement)[K][number][] };

export const Roles = {
    // Owner: full access, including deleting the organization.
    owner: ac.newRole(all),
    // Admin: same as owner but cannot delete the organization.
    admin: ac.newRole({ ...all, organization: ["view", "update"] }),
    member: ac.newRole({
        ...memberAc.statements,
        d4hEquipment: ["view"],
        organization: ["view"],
        member: ["view"],
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
        // Mirrors the session grant below: an assessor who can record a check must also be
        // able to amend it, and `approveSession` requires `skillCheck: ["update"]` alongside
        // `skillCheckSession: ["update"]`.
        skillCheck: ["view", "create", "update", "delete"],
        skillCheckSession: ["view", "create", "update", "delete"],
    }),
    "skill-package-author": ac.newRole({
        // `organizationProcedure` forces `organization: ["view"]` into every requirement, and
        // the org layout gates on it too — without this the role cannot reach anything.
        organization: ["view"],
        skillPackageBuilder: ["view", "create", "update", "delete", "publish"],
    }),
} as const;

export type Permissions = {
    [K in keyof typeof statement]?: (typeof statement)[K][number][];
};

export type Role = keyof typeof Roles;

export const roles = Object.keys(Roles) as Role[];
