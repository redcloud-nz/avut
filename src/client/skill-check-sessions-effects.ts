/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { SessionCheck, SkillCheck } from "@/lib/schemas/skill-check";
import type { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { mergeSessionChecks, patchOwnChecks } from "@/lib/session-checks-sync";
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

/** The session cache: every assessor's checks on the session, tombstones included. */
function sessionChecksQueryKey(organizationId: string, sessionId: string) {
    return trpc.skillCheckSessions.listSessionChecks.queryKey({
        organizationId,
        skillCheckSessionId: sessionId,
    });
}

/**
 * Merges a row a check write returned into the session cache, through the same newer-or-equal
 * rule as the poll (`mergeSessionChecks`), whether or not its id is already cached. So a stale
 * poll row that raced the write is rejected by the session merge and never reaches the own-checks
 * list.
 *
 * The write's response carries no names, and an updater only sees `old` for its own key, so the
 * names come from the cached row with the same id, else `""`. The next poll's copy has the same
 * `recordedAt` and fills them in; consumers skip a row whose names are still empty. An uncached
 * session list stays uncached.
 */
function mergeIntoSessionChecks(
    organizationId: string,
    sessionId: string,
    check: SkillCheck,
): MutationEffect {
    return write(sessionChecksQueryKey(organizationId, sessionId), (old) => {
        if (!old) return old;
        const cachedRow = old.checks.find((row) => row.id === check.id);
        const row: SessionCheck = {
            ...check,
            assesseeName: cachedRow?.assesseeName ?? "",
            skillName: cachedRow?.skillName ?? "",
            assessorName: cachedRow?.assessorName ?? "",
        };
        const { checks } = mergeSessionChecks(old.checks, [row]);
        return checks === old.checks ? old : { ...old, checks };
    });
}

/**
 * Sets the session cache's `sessionStatus` after an approve or reopen, so the sync hook doesn't
 * take the caller's own status change for one made elsewhere.
 */
function writeSessionChecksStatus(
    organizationId: string,
    sessionId: string,
    status: SkillCheckSession["status"],
): MutationEffect {
    return write(sessionChecksQueryKey(organizationId, sessionId), (old) =>
        old && old.sessionStatus !== status ? { ...old, sessionStatus: status } : old,
    );
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
 * (assessee, skill) pair, merge the returned row into the session cache (`listSessionChecks`), and
 * invalidate the org's other skill-check lists. `approveSession` and `reopenSession` also set the
 * session cache's `sessionStatus`.
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
        writeSessionChecksStatus(vars.organizationId, vars.sessionId, updated.status),
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
    deleteSessionSkillCheck: (vars, { check: tombstoned }) => [
        write(ownSessionChecksQueryKey(vars.organizationId, vars.skillCheckSessionId), (old) => {
            // The re-read found a live row: the caller's other device re-recorded the check after
            // the delete. Keep it, through the same stamp-guarded patch as the poll. The row's
            // assessor is the caller (so `assessorId` is set; it's only null for a purged assessor).
            if (tombstoned && tombstoned.status !== "Deleted" && tombstoned.assessorId) {
                return patchOwnChecks(
                    old,
                    [{ ...tombstoned, assesseeName: "", skillName: "", assessorName: "" }],
                    tombstoned.assessorId,
                );
            }
            const matches = (check: { assesseeId: string; skillId: string }) =>
                check.assesseeId === vars.assesseeId && check.skillId === vars.skillId;
            // Nothing to remove: keep the same array, so no subscriber re-renders.
            return old?.some(matches) ? old.filter((check) => !matches(check)) : old;
        }),
        // Usually the tombstone, but it can be a re-record from the caller's other device; the
        // merge keeps whichever is newer. Nothing to merge when nothing was deleted.
        ...(tombstoned
            ? [mergeIntoSessionChecks(vars.organizationId, vars.skillCheckSessionId, tombstoned)]
            : []),
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
        writeSessionChecksStatus(vars.organizationId, vars.skillCheckSessionId, updated.status),
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
        mergeIntoSessionChecks(vars.organizationId, vars.skillCheckSessionId, saved),
        ...invalidateOtherSkillCheckLists(vars.organizationId),
    ],
    // updateCheckExclusions moves the session's checks between Exclude and Draft server-side, so
    // every cached listSkillChecks for it refetches, as for approveSession.
    updateCheckExclusions: (vars) => [
        invalidate(
            trpc.skillChecks.listSkillChecks.queryFilter({
                organizationId: vars.organizationId,
                sessionId: vars.sessionId,
            }),
        ),
    ],
    updateSession: (vars, { updated, dateChanged }) => [
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
        // A date change re-stamps every check's `checkedAt` server-side, so the reads that show or
        // order by it refetch: the session's check lists, the competency matrix and recent checks.
        ...(dateChanged
            ? [
                  invalidate(
                      trpc.skillChecks.listSkillChecks.queryFilter({
                          organizationId: vars.organizationId,
                          sessionId: vars.skillCheckSessionId,
                      }),
                  ),
                  invalidate(
                      trpc.skillChecks.getCompetencyMatrix.queryFilter({
                          organizationId: vars.organizationId,
                      }),
                  ),
                  invalidate(
                      trpc.skillChecks.listRecentChecks.queryFilter({
                          organizationId: vars.organizationId,
                      }),
                  ),
                  // The session cache too, but by hand: invalidating it would only run a delta
                  // poll, which can't see the re-stamp (it leaves `recordedAt` alone). The server
                  // set every row in the session to the new date, so do the same here.
                  write(
                      sessionChecksQueryKey(vars.organizationId, vars.skillCheckSessionId),
                      (old) =>
                          old && {
                              ...old,
                              checks: old.checks.map((check) => ({
                                  ...check,
                                  checkedAt: updated.date,
                              })),
                          },
                  ),
              ]
            : []),
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
