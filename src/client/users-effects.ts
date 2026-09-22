/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/**
 * Cache effects for `users` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 * `linkPerson`/`unlinkPerson` reach into the `personnel` router's cache too, which is the case
 * this pattern is meant for: a call site adding a new place to link a person no longer needs to
 * remember all five affected queries.
 */
export const usersEffects = createEffects<"users">()({
    // Joining an organization adds a membership (and its activity feed) to the dashboard.
    acceptInvitation: (vars) => [
        invalidate(trpc.users.listInvitations.queryFilter()),
        invalidate(trpc.users.listMemberships.queryFilter()),
        invalidate(trpc.users.getActivityStats.queryFilter()),
        invalidate(trpc.invitations.getLanding.queryFilter({ invitationId: vars.invitationId })),
    ],

    rejectInvitation: (vars) => [
        invalidate(trpc.users.listInvitations.queryFilter()),
        invalidate(trpc.invitations.getLanding.queryFilter({ invitationId: vars.invitationId })),
    ],

    linkPerson: (vars) => [
        invalidate({ queryKey: ["auth", "organization-users", vars.organizationId] }),
        invalidate(
            trpc.users.getLinkedPerson.queryFilter({
                organizationId: vars.organizationId,
                userId: vars.userId,
            }),
        ),
        invalidate(trpc.users.listPersonLinks.queryFilter({ organizationId: vars.organizationId })),
        invalidate(
            trpc.personnel.listUnlinkedPersonnel.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
        invalidate(
            trpc.personnel.getLinkedUser.queryFilter({
                organizationId: vars.organizationId,
                personId: vars.personId,
            }),
        ),
        invalidate(
            trpc.personnel.getInviteState.queryFilter({
                organizationId: vars.organizationId,
                personId: vars.personId,
            }),
        ),
    ],
    // `unlinkPerson`'s input only carries `userId` — the `personId` being unlinked comes back
    // in the response instead, since the server already knows it from the existing link.
    unlinkPerson: (vars, data) => [
        invalidate({ queryKey: ["auth", "organization-users", vars.organizationId] }),
        invalidate(
            trpc.users.getLinkedPerson.queryFilter({
                organizationId: vars.organizationId,
                userId: vars.userId,
            }),
        ),
        invalidate(trpc.users.listPersonLinks.queryFilter({ organizationId: vars.organizationId })),
        invalidate(
            trpc.personnel.listUnlinkedPersonnel.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
        ...(data.personId
            ? [
                  invalidate(
                      trpc.personnel.getLinkedUser.queryFilter({
                          organizationId: vars.organizationId,
                          personId: data.personId,
                      }),
                  ),
              ]
            : []),
    ],

    revokeSession: () => [invalidate(trpc.users.listSessions.queryFilter())],
});
