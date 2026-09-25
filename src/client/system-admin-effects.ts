/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/**
 * Cache effects for `systemAdmin` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const systemAdminEffects = createEffects<"systemAdmin">()({
    createOrganization: () => [invalidate(trpc.systemAdmin.listOrganizations.queryFilter())],
    deleteUser: () => [
        invalidate(trpc.systemAdmin.listUsers.queryFilter()),
        invalidate(trpc.systemAdmin.listOrganizations.queryFilter()),
        invalidate(trpc.systemAdmin.getOrganization.queryFilter()),
    ],
    setUserRole: (vars) => [
        invalidate(trpc.systemAdmin.listUsers.queryFilter()),
        invalidate(trpc.systemAdmin.getUser.queryFilter({ userId: vars.userId })),
    ],
});
