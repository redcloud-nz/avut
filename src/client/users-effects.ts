/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/** Moving an account into, out of, or past the system Rubbish bin changes every user/member view. */
const userBinCaches = (vars: { userId: string }) => [
    invalidate(trpc.users.listUsers.queryFilter()),
    invalidate(trpc.users.listDeletedUsers.queryFilter()),
    invalidate(trpc.users.getUser.queryFilter({ userId: vars.userId })),
    invalidate(trpc.organizations.listOrganizations.queryFilter()),
    invalidate(trpc.organizations.getOrganizationAsAdmin.queryFilter()),
];

/**
 * Cache effects for `users` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 * `linkPerson`/`unlinkPerson` reach into the `personnel` router's cache too, which is the case
 * this pattern is meant for: a call site adding a new place to link a person no longer needs to
 * remember all five affected queries.
 */
export const usersEffects = createEffects<"users">()({
    banUser: (vars) => [
        invalidate(trpc.users.listUsers.queryFilter()),
        invalidate(trpc.users.getUser.queryFilter({ userId: vars.userId })),
    ],
    deleteUser: (vars) => userBinCaches(vars),
    linkPerson: (vars) => [
        invalidate(
            trpc.organizations.listMembers.queryFilter({ organizationId: vars.organizationId }),
        ),
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
        invalidate(
            trpc.users.listUnlinkedMembers.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
    purgeUser: (vars) => userBinCaches(vars),
    recoverUser: (vars) => userBinCaches(vars),
    revokeSession: () => [invalidate(trpc.user.listSessions.queryFilter())],
    setUserRole: (vars) => [
        invalidate(trpc.users.listUsers.queryFilter()),
        invalidate(trpc.users.getUser.queryFilter({ userId: vars.userId })),
    ],
    unbanUser: (vars) => [
        invalidate(trpc.users.listUsers.queryFilter()),
        invalidate(trpc.users.getUser.queryFilter({ userId: vars.userId })),
    ],
    // `unlinkPerson`'s input only carries `userId` — the `personId` being unlinked comes back
    // in the response instead, since the server already knows it from the existing link.
    unlinkPerson: (vars, data) => [
        invalidate(
            trpc.organizations.listMembers.queryFilter({ organizationId: vars.organizationId }),
        ),
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
            trpc.users.listUnlinkedMembers.queryFilter({ organizationId: vars.organizationId }),
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
});
