/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { createEffects, invalidate, write } from "@/trpc/mutation-effector";
import { trpc } from "@/trpc/client";

/**
 * Cache effects for `skills` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `MutationInvalidator`.
 * `createSession`'s response matches `getSession` exactly, so it writes wholesale. `updateSession`
 * and the session halves of `updateSessionAssessees`/`updateSessionSkills` return a bare
 * `SkillCheckSession` without the `assessors` extension `getSession` carries, so they merge into
 * whatever's already cached instead of replacing it.
 */
export const skillsEffects = createEffects<"skills">()({
    createSession: (vars, { created }) => [
        write(
            trpc.skills.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            created,
        ),
        invalidate(trpc.skills.listSessions.queryFilter({ organizationId: vars.organizationId })),
    ],
    deleteSession: (vars) => [
        // Mark the deleted session's detail query stale so navigating Back to its route
        // refetches (and 404s) rather than rendering the now-deleted session from cache.
        invalidate(
            trpc.skills.getSession.queryFilter({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
        ),
        invalidate(trpc.skills.listSessions.queryFilter({ organizationId: vars.organizationId })),
    ],
    subscribeToPackage: (vars, { created }) => [
        write(
            trpc.skills.getPackage.queryKey({
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
        invalidate(trpc.skills.listPackages.queryFilter({ organizationId: vars.organizationId })),
    ],
    unsubscribeFromPackage: (vars) => [
        write(
            trpc.skills.getPackage.queryKey({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
            (old) =>
                old
                    ? { ...old, subscription: null, subscriptionCount: old.subscriptionCount - 1 }
                    : old,
        ),
        invalidate(trpc.skills.listPackages.queryFilter({ organizationId: vars.organizationId })),
    ],
    updateSession: (vars, { updated }) => [
        write(
            trpc.skills.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            (old) => (old ? { ...old, ...updated } : old),
        ),
        invalidate(trpc.skills.listSessions.queryFilter({ organizationId: vars.organizationId })),
    ],
    updateSessionAssessees: (vars, { updatedAssessees, updatedSession }) => [
        write(
            trpc.skills.listSessionAssessees.queryKey({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
                scope: "assigned",
            }),
            updatedAssessees,
        ),
        write(
            trpc.skills.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            (old) => (old ? { ...old, ...updatedSession } : old),
        ),
        invalidate(
            trpc.skills.listSessionAssessees.queryFilter({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
                scope: "all",
            }),
        ),
    ],
    updateSessionSkills: (vars, { updatedSkills, updatedSession }) => [
        write(
            trpc.skills.listSessionSkills.queryKey({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
                scope: "assigned",
            }),
            updatedSkills,
        ),
        write(
            trpc.skills.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            (old) => (old ? { ...old, ...updatedSession } : old),
        ),
        invalidate(
            trpc.skills.listSessionSkills.queryFilter({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
                scope: "all",
            }),
        ),
    ],
});
