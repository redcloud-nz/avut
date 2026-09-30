/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect } from "react";

import { useQuery, useQueryClient, type QueryFunctionContext } from "@tanstack/react-query";

import { refetchSession } from "@/components/skill-track/use-refetch-session-on-conflict";
import { useOrganization } from "@/hooks/use-organization";
import type { PersonId } from "@/lib/schemas/person";
import type { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import {
    maxCursor,
    mergeSessionChecks,
    patchOwnChecks,
    type SessionChecksData,
} from "@/lib/session-checks-sync";
import { trpc, trpcClient } from "@/trpc/client";

/** How often the recording pages poll the session cache while the tab is visible. */
export const SESSION_CHECKS_POLL_MS = 10_000;

interface SessionChecksInput {
    organizationId: string;
    sessionId: SkillCheckSessionId;
    /** The caller's linked person, whose rows the poll also patches into the own-checks list. */
    selfPersonId: PersonId | undefined;
}

/**
 * Query options for the session cache (`listSessionChecks` without `since`), with a delta
 * `queryFn` in place of the tRPC one. The key stays the tRPC key, so the write effects in
 * `skillCheckSessionsEffects` reach the same cache entry.
 *
 * Each fetch:
 * 1. reads `since` from the cached data's `cursor` (none on the first load);
 * 2. fetches through `trpcClient` with the query's `signal`;
 * 3. re-reads the cache after the response and merges into that (`mergeSessionChecks`), not into
 *    the snapshot from before the fetch, so a write effect that ran while the request was in
 *    flight is kept. Nothing is awaited between the re-read and the `return`;
 * 4. patches the rows the merge applied into the caller's own-checks list (`patchOwnChecks`);
 * 5. keeps the later of the old and new cursors.
 *
 * On the first load (the re-read finds nothing cached) the response is taken as it is and the
 * own-checks list is left alone: it has its own query, and an own-list delete made while the
 * first load was in flight left no tombstone here (an uncached session list stays uncached), so
 * patching would bring the stale live row back. From the second response on, the effects have
 * written every local write into this cache, so the merge rejects stale rows before they reach
 * the own list.
 *
 * `sessionStatus` is taken from the response as it comes. A poll in flight across a local approve
 * or reopen can briefly put the old status back; `useSessionChecksSync` then sees a mismatch and
 * refetches the session once, which is accepted.
 *
 * TanStack runs the `queryFn` of whichever observer set its options last, so every observer of
 * this cache builds its options here, with the same inputs. `staleTime: 0` lives here for the
 * same reason.
 */
export function sessionChecksQueryOptions({
    organizationId,
    sessionId,
    selfPersonId,
}: SessionChecksInput) {
    const base = trpc.skillCheckSessions.listSessionChecks.queryOptions({
        organizationId,
        skillCheckSessionId: sessionId,
    });
    const ownChecksKey = trpc.skillChecks.listSkillChecks.queryKey({
        organizationId,
        sessionId,
        ownChecksOnly: true,
    });

    return {
        ...base,
        // Always stale, overriding the app-wide 10-minute default, so a window focus, a remount or
        // a new observer (the Recent checks dialog) refetches. Each refetch is a small delta.
        staleTime: 0,
        queryFn: async ({ client, signal }: QueryFunctionContext): Promise<SessionChecksData> => {
            const since = client.getQueryData(base.queryKey)?.cursor;
            const response = await trpcClient.skillCheckSessions.listSessionChecks.query(
                { organizationId, skillCheckSessionId: sessionId, since },
                { signal },
            );

            const cached = client.getQueryData(base.queryKey);
            if (!cached) return response;

            const { checks, applied } = mergeSessionChecks(cached.checks, response.checks);
            if (selfPersonId && applied.length > 0) {
                client.setQueryData(ownChecksKey, (own) =>
                    patchOwnChecks(own, applied, selfPersonId),
                );
            }
            return {
                checks,
                cursor: maxCursor(cached.cursor, response.cursor),
                sessionStatus: response.sessionStatus,
            };
        },
    };
}

/**
 * Observes a session's cache of every assessor's checks, for a reader that isn't the recording
 * page's poll (the Recent checks dialog). Shares the query with `useSessionChecksSync` through
 * `sessionChecksQueryOptions`. Pass `refetchInterval` to keep it live on its own.
 */
export function useSessionChecks({
    sessionId,
    selfPersonId,
    enabled,
    refetchInterval,
}: {
    sessionId: SkillCheckSessionId;
    selfPersonId: PersonId | undefined;
    enabled: boolean;
    refetchInterval?: number;
}) {
    const organization = useOrganization();

    // Not a suspense query, deliberately (an exception to detail-page-data-fetching.md): what
    // this feeds, the other assessors' markers and the Recent checks list, is secondary, and the
    // page shouldn't wait for it. The page renders as before, and they appear once the first
    // response lands.
    return useQuery({
        ...sessionChecksQueryOptions({
            organizationId: organization.id,
            sessionId,
            selfPersonId,
        }),
        enabled,
        refetchInterval,
    });
}

/**
 * Polls a session's checks every 10 s while the tab is visible (TanStack's default
 * `refetchIntervalInBackground: false`; `refetchOnWindowFocus` catches up on return), keeping the
 * session cache and the caller's own-checks list in step with other assessors and the caller's
 * other devices.
 *
 * When a response's `sessionStatus` differs from the cached `getSession`'s, the session was
 * approved or reopened elsewhere, so it refetches the session (`refetchSession`) and the page
 * turns read-only, or editable again, without first hitting a `CONFLICT`.
 *
 * Enable it only while the recording rows show. It keeps polling on an approved session, which is
 * how a reopen gets noticed.
 *
 * @returns the session cache's data, `undefined` until the first response.
 */
export function useSessionChecksSync({
    sessionId,
    selfPersonId,
    enabled,
}: {
    sessionId: SkillCheckSessionId;
    selfPersonId: PersonId | undefined;
    enabled: boolean;
}): SessionChecksData | undefined {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const { data } = useSessionChecks({
        sessionId,
        selfPersonId,
        enabled,
        refetchInterval: SESSION_CHECKS_POLL_MS,
    });

    const sessionStatus = data?.sessionStatus;
    useEffect(() => {
        if (!sessionStatus) return;
        const session = queryClient.getQueryData(
            trpc.skillCheckSessions.getSession.queryKey({
                organizationId: organization.id,
                skillCheckSessionId: sessionId,
            }),
        );
        if (session && session.status !== sessionStatus) {
            refetchSession(queryClient, organization.id, sessionId);
        }
    }, [sessionStatus, queryClient, organization.id, sessionId]);

    return data;
}
