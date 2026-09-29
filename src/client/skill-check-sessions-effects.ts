/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate, write } from "@/trpc/mutation-effector";

/**
 * Cache effects for `skillCheckSessions` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 * `createSession`'s response matches `getSession` exactly, so it writes wholesale. `updateSession`
 * and the session halves of `updateSessionAssessees`/`updateSessionSkills` return a bare
 * `SkillCheckSession` without the `assessors` extension `getSession` carries, so they merge into
 * whatever's already cached instead of replacing it. `updateSessionAssessors` merges its
 * `updatedAssessors` in as that `assessors` extension too.
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
