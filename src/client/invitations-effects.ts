/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { authQueryKeys } from "@/lib/auth-query-keys";
import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/**
 * Cache effects for `invitations` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const invitationsEffects = createEffects<"invitations">()({
    // The new account is signed in on success, so the landing page's `viewer` — and the session
    // itself — have both changed underneath their cached copies.
    signUp: (vars) => [
        invalidate(trpc.invitations.getLanding.queryFilter({ invitationId: vars.invitationId })),
        invalidate({ queryKey: authQueryKeys.session }),
    ],
});
