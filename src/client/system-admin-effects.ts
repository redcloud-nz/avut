/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/** Moving an account into, out of, or past the system Rubbish bin changes every user/member view. */
const userBinCaches = (vars: { userId: string }) => [
    invalidate(trpc.systemAdmin.listUsers.queryFilter()),
    invalidate(trpc.systemAdmin.listDeletedUsers.queryFilter()),
    invalidate(trpc.systemAdmin.getUser.queryFilter({ userId: vars.userId })),
    invalidate(trpc.systemAdmin.listOrganizations.queryFilter()),
    invalidate(trpc.systemAdmin.getOrganization.queryFilter()),
];

/**
 * Cache effects for `systemAdmin` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const systemAdminEffects = createEffects<"systemAdmin">()({
    banUser: (vars) => [
        invalidate(trpc.systemAdmin.listUsers.queryFilter()),
        invalidate(trpc.systemAdmin.getUser.queryFilter({ userId: vars.userId })),
    ],
    createOrganization: () => [invalidate(trpc.systemAdmin.listOrganizations.queryFilter())],
    deleteUser: (vars) => userBinCaches(vars),
    purgeUser: (vars) => userBinCaches(vars),
    recoverUser: (vars) => userBinCaches(vars),
    setUserRole: (vars) => [
        invalidate(trpc.systemAdmin.listUsers.queryFilter()),
        invalidate(trpc.systemAdmin.getUser.queryFilter({ userId: vars.userId })),
    ],
    unbanUser: (vars) => [
        invalidate(trpc.systemAdmin.listUsers.queryFilter()),
        invalidate(trpc.systemAdmin.getUser.queryFilter({ userId: vars.userId })),
    ],
});
