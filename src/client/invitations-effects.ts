/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/**
 * Cache effects for `invitations` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const invitationsEffects = createEffects<"invitations">()({
    cancelInvitation: (vars) => [
        invalidate(
            trpc.invitations.listInvitations.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
    // `createInvitation` also refreshes `personnel.getInviteState` when it carries a `personId` —
    // that's `invite-person.tsx`'s dialog, whose state (Linked / AlreadyMember / Invite) depends
    // on whether an invitation is now pending for that person.
    createInvitation: (vars) => [
        invalidate(
            trpc.invitations.listInvitations.queryFilter({ organizationId: vars.organizationId }),
        ),
        ...(vars.personId
            ? [
                  invalidate(
                      trpc.personnel.getInviteState.queryFilter({
                          organizationId: vars.organizationId,
                          personId: vars.personId,
                      }),
                  ),
              ]
            : []),
    ],
    // The new account is signed in on success, so the landing page's `viewer` — and the session
    // itself — have both changed underneath their cached copies.
    signUp: (vars) => [
        invalidate(trpc.invitations.getLanding.queryFilter({ invitationId: vars.invitationId })),
        invalidate(trpc.user.getSession.queryFilter()),
    ],
});
