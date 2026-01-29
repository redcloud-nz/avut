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
    organization: ["view", "update", "delete"],
    person: ["create", "update", "delete", "archive", "restore"],
    skillPackage: ["create", "update", "delete", "publish"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
    ...ownerAc.statements,
    organization: ["view", "update", "delete"],
    person: ["create", "update", "delete", "archive", "restore"],
    skillPackage: ["create", "update", "delete", "publish"],
});
export const admin = ac.newRole({
    ...adminAc.statements,
    organization: ["view", "update"],
    person: ["create", "update", "delete", "archive", "restore"],
    skillPackage: ["create", "update", "delete", "publish"],
});

export const member = ac.newRole({
    ...memberAc.statements,
    organization: ["view"],
});

export type Permissions = {
    [K in keyof typeof statement]?: (typeof statement)[K][number][];
};
