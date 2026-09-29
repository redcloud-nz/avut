/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { hashKey, useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";

import { skillCheckSessionsEffects } from "@/client/skill-check-sessions-effects";
import { useOrganization } from "@/hooks/use-organization";
import type { PersonId } from "@/lib/schemas/person";
import type { SkillId } from "@/lib/schemas/skill";
import type { SkillCheckResultValue } from "@/lib/schemas/skill-check";
import type { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc, type RouterInput } from "@/trpc/client";

/** Identifies one check on a session's recording page: the (assessee, skill) pair. */
export type SessionCheckKey = `${PersonId}::${SkillId}`;

export function sessionCheckKey(assesseeId: PersonId, skillId: SkillId): SessionCheckKey {
    return `${assesseeId}::${skillId}`;
}

type SetVariables = RouterInput["skillCheckSessions"]["setSessionSkillCheck"];
type DeleteVariables = RouterInput["skillCheckSessions"]["deleteSessionSkillCheck"];

/**
 * Records and removes the caller's own checks on a session, one check per call, through
 * `setSessionSkillCheck` and `deleteSessionSkillCheck`.
 *
 * - `record` is silent on success and toasts on error.
 * - `remove` toasts "Check removed" with an **Undo** action that re-records the deleted check's
 *   result and notes, and toasts on error. The re-record revives the deleted row as a `Draft`
 *   check. An approved session's `Include` checks can't be deleted in the first place (the lock),
 *   and any other status needs a fresh review anyway, so Undo is offered whatever the removed
 *   check's status was.
 * - A `CONFLICT` from either write means the session was approved under the page. Both then
 *   invalidate the session's `getSession`, so the page picks up the approval and turns read-only.
 *
 * Every toast lives in the `useMutation` options rather than in per-call `mutate` callbacks:
 * TanStack fires per-call callbacks only for the observer's latest mutation, so a second delete
 * in quick succession would otherwise drop the first one's Undo. The deleted check's values are
 * read from the own-checks cache in `onMutate`, before the effect removes them, and reach
 * `onSuccess` as its `onMutate` result.
 *
 * The "Check removed" toast is keyed by `sessionCheckKey`, and `record`/`remove` dismiss their
 * key's toast before mutating. So an Undo can't overwrite a newer value recorded for the same
 * check while the toast is still up, and repeat deletes of one check share a single toast.
 *
 * Pair with `usePendingChecks` to show which rows have a write in flight.
 */
export function useSessionCheckRecorder({ sessionId }: { sessionId: SkillCheckSessionId }) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    // Called from both mutations' `onError`. `meta.effects` only runs on success, so this one is
    // by hand.
    const refetchSessionOnConflict = useCallback(
        (
            error: { data?: { code?: string } | null },
            vars: { organizationId: string; skillCheckSessionId: string },
        ) => {
            if (error.data?.code !== "CONFLICT") return;
            void queryClient.invalidateQueries(
                trpc.skillCheckSessions.getSession.queryFilter({
                    organizationId: vars.organizationId,
                    skillCheckSessionId: vars.skillCheckSessionId,
                }),
            );
        },
        [queryClient],
    );

    const { mutate: mutateSet } = useMutation(
        trpc.skillCheckSessions.setSessionSkillCheck.mutationOptions({
            meta: { effects: skillCheckSessionsEffects.setSessionSkillCheck },
            onError(error, vars) {
                toast.error(`Failed to save check: ${error.message}`);
                refetchSessionOnConflict(error, vars);
            },
        }),
    );

    const { mutate: mutateDelete } = useMutation(
        trpc.skillCheckSessions.deleteSessionSkillCheck.mutationOptions({
            meta: { effects: skillCheckSessionsEffects.deleteSessionSkillCheck },
            onMutate(vars) {
                const ownChecks = queryClient.getQueryData(
                    trpc.skillChecks.listSkillChecks.queryKey({
                        organizationId: vars.organizationId,
                        sessionId: vars.skillCheckSessionId,
                        ownChecksOnly: true,
                    }),
                );
                const removed = ownChecks?.find(
                    (check) =>
                        check.assesseeId === vars.assesseeId && check.skillId === vars.skillId,
                );
                return {
                    removed: removed ? { result: removed.result, notes: removed.notes } : null,
                };
            },
            onSuccess({ deleted }, vars, onMutateResult) {
                if (!deleted) return;
                const removed = onMutateResult?.removed;
                const id = sessionCheckKey(vars.assesseeId as PersonId, vars.skillId as SkillId);
                toast.success(
                    "Check removed",
                    removed
                        ? {
                              id,
                              action: {
                                  label: "Undo",
                                  onClick: () =>
                                      mutateSet({
                                          organizationId: vars.organizationId,
                                          skillCheckSessionId: vars.skillCheckSessionId,
                                          assesseeId: vars.assesseeId,
                                          skillId: vars.skillId,
                                          result: removed.result,
                                          notes: removed.notes,
                                      }),
                              },
                          }
                        : { id },
                );
            },
            onError(error, vars) {
                toast.error(`Failed to remove check: ${error.message}`);
                refetchSessionOnConflict(error, vars);
            },
        }),
    );

    const record = useCallback(
        (check: {
            assesseeId: PersonId;
            skillId: SkillId;
            result: SkillCheckResultValue;
            notes: string;
        }) => {
            toast.dismiss(sessionCheckKey(check.assesseeId, check.skillId));
            mutateSet({
                organizationId: organization.id,
                skillCheckSessionId: sessionId,
                ...check,
            });
        },
        [mutateSet, organization.id, sessionId],
    );

    const remove = useCallback(
        (target: { assesseeId: PersonId; skillId: SkillId }) => {
            toast.dismiss(sessionCheckKey(target.assesseeId, target.skillId));
            mutateDelete({
                organizationId: organization.id,
                skillCheckSessionId: sessionId,
                ...target,
            });
        },
        [mutateDelete, organization.id, sessionId],
    );

    return { record, remove };
}

/**
 * The session's checks with a `setSessionSkillCheck` or `deleteSessionSkillCheck` in flight, keyed
 * by `sessionCheckKey`: the pending result, or `null` for a pending delete. If one key somehow has
 * several writes pending, the latest wins.
 *
 * One `useMutationState` call for the whole page. Call it once, at the page's top level, and pass
 * each row its entry, rather than calling a hook per row.
 */
export function usePendingChecks(
    sessionId: SkillCheckSessionId,
): Map<SessionCheckKey, SkillCheckResultValue | null> {
    // A single filter can't take two mutation keys, and the shared prefix
    // `[["skillCheckSessions"]]` would match every session mutation, so the predicate compares
    // hashed keys itself.
    const setKeyHash = hashKey(trpc.skillCheckSessions.setSessionSkillCheck.mutationKey());
    const deleteKeyHash = hashKey(trpc.skillCheckSessions.deleteSessionSkillCheck.mutationKey());

    const pending = useMutationState({
        filters: {
            status: "pending",
            predicate: (mutation) => {
                const mutationKey = mutation.options.mutationKey;
                if (!mutationKey) return false;
                const keyHash = hashKey(mutationKey);
                if (keyHash !== setKeyHash && keyHash !== deleteKeyHash) return false;
                const variables = mutation.state.variables as
                    | { skillCheckSessionId?: string }
                    | undefined;
                return variables?.skillCheckSessionId === sessionId;
            },
        },
        select: (mutation) => ({
            mutationKey: mutation.options.mutationKey,
            variables: mutation.state.variables as SetVariables | DeleteVariables,
        }),
    });

    return useMemo(() => {
        const map = new Map<SessionCheckKey, SkillCheckResultValue | null>();
        for (const { mutationKey, variables } of pending) {
            const isDelete = mutationKey !== undefined && hashKey(mutationKey) === deleteKeyHash;
            // Mutation variables are the procedure's input type, where ids aren't branded yet.
            map.set(
                sessionCheckKey(variables.assesseeId as PersonId, variables.skillId as SkillId),
                isDelete ? null : (variables as SetVariables).result,
            );
        }
        return map;
    }, [pending, deleteKeyHash]);
}
