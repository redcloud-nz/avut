/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { invalidate } from "@/trpc/mutation-invalidator";
import { trpc } from "@/trpc/client";
import type { RouterInput, RouterOutput } from "@/trpc/routers/_app";

/**
 * Cache effects for `users` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `MutationInvalidator`.
 * `linkPerson`/`unlinkPerson` reach into the `personnel` router's cache too, which is the case
 * this pattern is meant for: a call site adding a new place to link a person no longer needs to
 * remember all five affected queries.
 */
export const usersEffects = {
    linkPerson: (vars: RouterInput["users"]["linkPerson"]) => [
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
    ],
    // `unlinkPerson`'s input only carries `userId` — the `personId` being unlinked comes back
    // in the response instead, since the server already knows it from the existing link.
    unlinkPerson: (
        vars: RouterInput["users"]["unlinkPerson"],
        data: RouterOutput["users"]["unlinkPerson"],
    ) => [
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
};
