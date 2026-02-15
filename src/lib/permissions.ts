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
    skillPackage: ["view", "create", "update", "delete", "publish"],
    team: ["view", "create", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
    ...ownerAc.statements,
    d4hAccessToken: ["view", "create", "update", "delete"],
    invitation: ["view", "create", "cancel"],
    member: ["view", "create", "update", "delete"],
    organization: ["view", "update", "delete"],
    person: ["view", "create", "update", "delete", "archive", "restore"],
    skillPackage: ["view", "create", "update", "delete", "publish"],
    team: ["view", "create", "update", "delete"],
});
export const admin = ac.newRole({
    ...adminAc.statements,
    d4hAccessToken: ["view", "create", "update", "delete"],
    invitation: ["view", "create", "cancel"],
    member: ["view", "create", "update", "delete"],
    organization: ["view", "update"],
    person: ["view", "create", "update", "delete", "archive", "restore"],
    skillPackage: ["view", "create", "update", "delete", "publish"],
    team: ["view", "create", "update", "delete"],
});

export const member = ac.newRole({
    ...memberAc.statements,
    organization: ["view"],
    person: ["view"],
    skillPackage: ["view"],
    team: ["view"],
});

export type Permissions = {
    [K in keyof typeof statement]?: (typeof statement)[K][number][];
};
