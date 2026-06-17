/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { createAccessControl } from "better-auth/plugins/access";
import {
    defaultStatements,
    adminAc,
    ownerAc,
    memberAc,
} from "better-auth/plugins/organization/access";

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
    skillPackageSubscription: ["view", "subscribe", "assess"],
    skillCheck: ["view", "create", "update", "delete"],
    skillCheckSession: ["view", "create", "update", "delete"],
    skillPackageBuilder: ["view", "create", "update", "delete", "publish"],
    team: ["view", "create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const Roles = {
    owner: ac.newRole({
        ...ownerAc.statements,
        d4hAccessToken: ["view", "create", "update", "delete"],
        d4hEquipment: ["view"],
        i3Item: ["view", "issue", "inspect", "return"],
        i3Template: ["view", "create", "update", "delete"],
        invitation: ["view", "create", "update", "cancel"],
        member: ["view", "create", "update", "delete"],
        organization: ["view", "update", "delete"],
        person: ["view", "create", "update", "delete", "archive", "restore"],
        skillPackageSubscription: ["view", "subscribe", "assess"],
        skillCheck: ["view", "create", "update", "delete"],
        skillCheckSession: ["view", "create", "update", "delete"],
        skillPackageBuilder: ["view", "create", "update", "delete", "publish"],
        team: ["view", "create", "update", "delete"],
    }),
    admin: ac.newRole({
        ...adminAc.statements,
        d4hAccessToken: ["view", "create", "update", "delete"],
        d4hEquipment: ["view"],
        i3Item: ["view", "issue", "inspect", "return"],
        i3Template: ["view", "create", "update", "delete"],
        invitation: ["view", "create", "update", "cancel"],
        member: ["view", "create", "update", "delete"],
        organization: ["view", "update"],
        person: ["view", "create", "update", "delete", "archive", "restore"],
        skillPackageSubscription: ["view", "subscribe", "assess"],
        skillCheck: ["view", "create", "update", "delete"],
        skillCheckSession: ["view", "create", "update", "delete"],
        skillPackageBuilder: ["view", "create", "update", "delete", "publish"],
        team: ["view", "create", "update", "delete"],
    }),
    member: ac.newRole({
        ...memberAc.statements,
        d4hEquipment: ["view"],
        organization: ["view"],
        member: ["view"],
        person: ["view"],
        skillPackageSubscription: ["view"],
        team: ["view"],
    }),
    "i3-admin": ac.newRole({
        d4hEquipment: ["view"],
        i3Item: ["view", "issue", "inspect", "return"],
        i3Template: ["view", "create", "update", "delete"],
        organization: ["view"],
        person: ["view"],
    }),
    "i3-user": ac.newRole({
        d4hEquipment: ["view"],
        i3Item: ["view", "issue", "inspect", "return"],
        i3Template: ["view"],
        organization: ["view"],
        person: ["view"],
    }),
    "skills-admin": ac.newRole({
        organization: ["view"],
        person: ["view"],
        skillPackageSubscription: ["view", "subscribe", "assess"],
        skillCheck: ["view", "create", "update", "delete"],
        skillCheckSession: ["view", "create", "update", "delete"],
    }),
    "skills-assessor": ac.newRole({
        organization: ["view"],
        skillPackageSubscription: ["view", "assess"],
        skillCheck: ["view", "create"],
        skillCheckSession: ["view", "create", "update", "delete"],
    }),
    "skill-package-author": ac.newRole({
        skillPackageBuilder: ["view", "create", "update", "delete", "publish"],
    }),
} as const;

export type Permissions = {
    [K in keyof typeof statement]?: (typeof statement)[K][number][];
};

export type Role = keyof typeof Roles;

export const roles = Object.keys(Roles) as Role[];
