/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate, write } from "@/trpc/mutation-effector";

/**
 * Cache effects for `skillPackageSubscriptions` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const skillPackageSubscriptionsEffects = createEffects<"skillPackageSubscriptions">()({
    subscribeToPackage: (vars, { created }) => [
        write(
            trpc.skillPackageSubscriptions.getPackage.queryKey({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
            (old) =>
                old
                    ? {
                          ...old,
                          subscription: created,
                          subscriptionCount: old.subscriptionCount + 1,
                      }
                    : old,
        ),
        invalidate(
            trpc.skillPackageSubscriptions.listPackages.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
        invalidate(
            trpc.skillPackageSubscriptions.listAssessableSkills.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
        invalidate(
            trpc.skillPackageSubscriptions.listSubscribedPackages.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    unsubscribeFromPackage: (vars) => [
        write(
            trpc.skillPackageSubscriptions.getPackage.queryKey({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
            (old) =>
                old
                    ? {
                          ...old,
                          subscription: null,
                          subscriptionCount: Math.max(0, old.subscriptionCount - 1),
                      }
                    : old,
        ),
        invalidate(
            trpc.skillPackageSubscriptions.listPackages.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
        invalidate(
            trpc.skillPackageSubscriptions.listAssessableSkills.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
        invalidate(
            trpc.skillPackageSubscriptions.listSubscribedPackages.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
});
