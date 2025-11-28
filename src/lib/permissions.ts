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
    person: ["create", "update", "delete"],
    skillPackage: ["create", "update", "delete", "publish"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
    person: ["create", "update", "delete"],
    skillPackage: ["create", "update", "delete", "publish"],
    ...ownerAc.statements,
});
export const admin = ac.newRole({
    person: ["create", "update", "delete"],
    skillPackage: ["create", "update", "delete", "publish"],
    ...adminAc.statements,
});

export const member = ac.newRole({
    ...memberAc.statements,
});

export type Permissions = {
    [K in keyof typeof statement]?: (typeof statement)[K][number][];
};
