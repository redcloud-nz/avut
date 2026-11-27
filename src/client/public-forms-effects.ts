/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/**
 * Cache effects for `publicForms` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const publicFormsEffects = createEffects<"publicForms">()({
    // The form's status and its submitted answers change. Draft saves have no effect, so the open
    // form isn't re-seeded from the cache while the member types.
    reopenSelfAuditByToken: (vars) => [
        invalidate(trpc.publicForms.getSelfAuditByToken.queryFilter({ token: vars.token })),
    ],
    submitSelfAuditByToken: (vars) => [
        invalidate(trpc.publicForms.getSelfAuditByToken.queryFilter({ token: vars.token })),
    ],
});
