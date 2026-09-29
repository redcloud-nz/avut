/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate, write, type MutationEffect } from "@/trpc/mutation-effector";

/** The recording pages' own-checks list, which `setSessionSkillCheck`/`deleteSessionSkillCheck` write. */
function ownSessionChecksQueryKey(organizationId: string, sessionId: string) {
    return trpc.skillChecks.listSkillChecks.queryKey({
        organizationId,
        sessionId,
        ownChecksOnly: true,
    });
}

/**
 * Invalidates every skill-check list for the org except the own-checks lists, which the caller
 * has just written: the session's Contents counts, Checks and Review, the org dashboard's stats,
 * the skill-checks collection and the recent-checks list.
 *
 * The effector awaits these refetches before the mutation leaves `pending`, and the recording
 * rows stay dimmed while it's pending, so a predicate that also matched the own-checks list would
 * hold every tap behind a refetch of it.
 */
function invalidateOtherSkillCheckLists(organizationId: string): MutationEffect[] {
    return [
        invalidate(
            trpc.skillChecks.listSkillChecks.queryFilter(
                { organizationId },
                {
                    predicate: (query) =>
                        (query.queryKey[1] as { input?: { ownChecksOnly?: boolean } } | undefined)
                            ?.input?.ownChecksOnly !== true,
                },
            ),
        ),
        invalidate(trpc.skillChecks.listRecentChecks.queryFilter({ organizationId })),
    ];
}

/**
 * Invalidates the org-wide reads that change with a session's status: the sessions list (its rows
 * carry `status`) and the competency matrix, which counts only approved sessions' `Include` checks.
 * Shared by `approveSession` and `reopenSession`. `listRecentChecks` and the org-wide
 * `listSkillChecks` aren't invalidated: nothing renders a check's status there.
 */
function invalidateSessionStatusReaders(organizationId: string): MutationEffect[] {
    return [
        invalidate(trpc.skillCheckSessions.listSessions.queryFilter({ organizationId })),
        invalidate(trpc.skillChecks.getCompetencyMatrix.queryFilter({ organizationId })),
    ];
}

/**
 * Cache effects for `skillCheckSessions` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 * `createSession`'s response matches `getSession` exactly, so it writes wholesale.
 * `approveSession`, `reopenSession`, `updateSession` and the session halves of
 * `updateSessionAssessees`/`updateSessionSkills` return a bare `SkillCheckSession` without the
 * `assessors` extension `getSession` carries, so they merge into whatever's already cached instead
 * of replacing it. `updateSessionAssessors` merges its
 * `updatedAssessors` in as that `assessors` extension too. `setSessionSkillCheck` and
 * `deleteSessionSkillCheck` edit the caller's own-checks list in place, matching on the
 * (assessee, skill) pair, and invalidate the org's other skill-check lists.
 */
export const skillCheckSessionsEffects = createEffects<"skillCheckSessions">()({
    approveSession: (vars, { updated }) => [
        write(
            trpc.skillCheckSessions.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.sessionId,
            }),
            (old) => (old ? { ...old, ...updated } : old),
        ),
        // approveSession updates every matching skillCheck row server-side (Include/Exclude), so
        // any cached listSkillChecks for this session — including scoped variants like
        // ownChecksOnly — needs to refetch rather than keep showing pre-approval statuses.
        invalidate(
            trpc.skillChecks.listSkillChecks.queryFilter({
                organizationId: vars.organizationId,
                sessionId: vars.sessionId,
            }),
        ),
        ...invalidateSessionStatusReaders(vars.organizationId),
    ],
    createSession: (vars, { created }) => [
        write(
            trpc.skillCheckSessions.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            created,
        ),
        invalidate(
            trpc.skillCheckSessions.listSessions.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    deleteSession: (vars) => [
        // Mark the deleted session's detail query stale so navigating Back to its route
        // refetches (and 404s) rather than rendering the now-deleted session from cache.
        invalidate(
            trpc.skillCheckSessions.getSession.queryFilter({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
        ),
        invalidate(
            trpc.skillCheckSessions.listSessions.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    deleteSessionSkillCheck: (vars) => [
        write(ownSessionChecksQueryKey(vars.organizationId, vars.skillCheckSessionId), (old) => {
            const matches = (check: { assesseeId: string; skillId: string }) =>
                check.assesseeId === vars.assesseeId && check.skillId === vars.skillId;
            // Nothing to remove: keep the same array, so no subscriber re-renders.
            return old?.some(matches) ? old.filter((check) => !matches(check)) : old;
        }),
        ...invalidateOtherSkillCheckLists(vars.organizationId),
    ],
    reopenSession: (vars, { updated }) => [
        write(
            trpc.skillCheckSessions.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            (old) => (old ? { ...old, ...updated } : old),
        ),
        // reopenSession moves the session's Include checks to Pending server-side, so every
        // cached listSkillChecks for it (ownChecksOnly included) refetches.
        invalidate(
            trpc.skillChecks.listSkillChecks.queryFilter({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
            }),
        ),
        ...invalidateSessionStatusReaders(vars.organizationId),
    ],
    setSessionSkillCheck: (vars, saved) => [
        write(ownSessionChecksQueryKey(vars.organizationId, vars.skillCheckSessionId), (old) => {
            if (!old) return old;
            const matches = (check: { assesseeId: string; skillId: string }) =>
                check.assesseeId === saved.assesseeId && check.skillId === saved.skillId;
            return old.some(matches)
                ? old.map((check) => (matches(check) ? saved : check))
                : [...old, saved];
        }),
        ...invalidateOtherSkillCheckLists(vars.organizationId),
    ],
    updateSession: (vars, { updated }) => [
        write(
            trpc.skillCheckSessions.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            (old) => (old ? { ...old, ...updated } : old),
        ),
        invalidate(
            trpc.skillCheckSessions.listSessions.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    updateSessionAssessees: (vars, { updatedAssessees, updatedSession }) => [
        write(
            trpc.skillCheckSessions.listSessionAssessees.queryKey({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
                scope: "assigned",
            }),
            updatedAssessees,
        ),
        write(
            trpc.skillCheckSessions.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            (old) => (old ? { ...old, ...updatedSession } : old),
        ),
        invalidate(
            trpc.skillCheckSessions.listSessionAssessees.queryFilter({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
                scope: "all",
            }),
        ),
    ],
    updateSessionAssessors: (vars, { updatedAssessors, updatedSession }) => [
        write(
            trpc.skillCheckSessions.listSessionAssessors.queryKey({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
                scope: "assigned",
            }),
            updatedAssessors,
        ),
        // getSession carries `assessors`, so this one merges the new list in as well.
        write(
            trpc.skillCheckSessions.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            (old) => (old ? { ...old, ...updatedSession, assessors: updatedAssessors } : old),
        ),
        invalidate(
            trpc.skillCheckSessions.listSessionAssessors.queryFilter({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
                scope: "all",
            }),
        ),
        // listSessions rows carry `assessors`.
        invalidate(
            trpc.skillCheckSessions.listSessions.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    updateSessionSkills: (vars, { updatedSkills, updatedSession }) => [
        write(
            trpc.skillCheckSessions.listSessionSkills.queryKey({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
                scope: "assigned",
            }),
            updatedSkills,
        ),
        write(
            trpc.skillCheckSessions.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            (old) => (old ? { ...old, ...updatedSession } : old),
        ),
        invalidate(
            trpc.skillCheckSessions.listSessionSkills.queryFilter({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
                scope: "all",
            }),
        ),
    ],
});
