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
    invitation: ["view", "create", "cancel"],
    member: ["view", "create", "update", "delete"],
    organization: ["view", "update", "delete"],
    person: ["view", "create", "update", "delete", "archive", "restore"],
    skills: ["view", "subscribe", "assess"],
    skillPackageBuilder: ["view", "create", "update", "delete", "publish"],
    team: ["view", "create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const Roles = {
    owner: ac.newRole({
        ...ownerAc.statements,
        d4hAccessToken: ["view", "create", "update", "delete"],
        invitation: ["view", "create", "cancel"],
        member: ["view", "create", "update", "delete"],
        organization: ["view", "update", "delete"],
        person: ["view", "create", "update", "delete", "archive", "restore"],
        skills: ["view", "subscribe", "assess"],
        skillPackageBuilder: ["view", "create", "update", "delete", "publish"],
        team: ["view", "create", "update", "delete"],
    }),
    admin: ac.newRole({
        ...adminAc.statements,
        d4hAccessToken: ["view", "create", "update", "delete"],
        invitation: ["view", "create", "cancel"],
        member: ["view", "create", "update", "delete"],
        organization: ["view", "update"],
        person: ["view", "create", "update", "delete", "archive", "restore"],
        skills: ["view", "subscribe", "assess"],
        skillPackageBuilder: ["view", "create", "update", "delete", "publish"],
        team: ["view", "create", "update", "delete"],
    }),
    member: ac.newRole({
        ...memberAc.statements,
        organization: ["view"],
        person: ["view"],
        skills: ["view"],
        team: ["view"],
    }),
    "skills-admin": ac.newRole({
        organization: ["view"],
        person: ["view"],
        skills: ["view", "subscribe", "assess"],
    }),
    "skills-assessor": ac.newRole({
        organization: ["view"],
    }),
    "skills-author": ac.newRole({
        skillPackageBuilder: ["view", "create", "update", "delete", "publish"],
    }),
} as const;

export type Permissions = {
    [K in keyof typeof statement]?: (typeof statement)[K][number][];
};
