/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/**
 * Cache effects for `kitChecks` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const kitChecksEffects = createEffects<"kitChecks">()({
    // The new check joins the list. Its page isn't cached yet, but the send updates every
    // request's delivery, so any entry for it is refetched.
    createKitCheck: ({ organizationId }, { kitCheckId }) => [
        invalidate(trpc.kitChecks.listKitChecks.queryFilter({ organizationId })),
        invalidate(trpc.kitChecks.getKitCheck.queryFilter({ organizationId, kitCheckId })),
    ],
});
