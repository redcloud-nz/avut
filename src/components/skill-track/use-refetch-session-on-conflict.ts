/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useCallback } from "react";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";

import { useOrganization } from "@/hooks/use-organization";
import type { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

/**
 * Invalidates a session's `getSession` and its `listSkillChecks` queries (the own-checks list
 * included), for when the session changed under the page: it was approved or reopened elsewhere,
 * or its checks no longer match what the page shows. The page picks up the new status (turning
 * read-only on an approval) and shows the checks as they are now.
 *
 * Shared by `useRefetchSessionOnConflict` and `useSessionChecksSync`.
 */
export function refetchSession(
    queryClient: QueryClient,
    organizationId: string,
    sessionId: SkillCheckSessionId,
) {
    void queryClient.invalidateQueries(
        trpc.skillCheckSessions.getSession.queryFilter({
            organizationId,
            skillCheckSessionId: sessionId,
        }),
    );
    void queryClient.invalidateQueries(
        trpc.skillChecks.listSkillChecks.queryFilter({ organizationId, sessionId }),
    );
}

/**
 * Returns an `onError` helper for a mutation that writes a skill check session's checks or config,
 * or approves it. A `CONFLICT` from one of those means the session changed under the page: it was
 * approved (the approval lock); for `approveSession`, the session or its checks no longer match
 * what the page showed; or, for `updateCheckExclusions`, a check the mutation names was deleted
 * since. So it refetches the session (`refetchSession`). Any other error is left alone.
 *
 * `meta.effects` only runs on success, which is why this is done by hand.
 */
export function useRefetchSessionOnConflict(sessionId: SkillCheckSessionId) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    return useCallback(
        (error: { data?: { code?: string } | null }) => {
            if (error.data?.code !== "CONFLICT") return;
            refetchSession(queryClient, organization.id, sessionId);
        },
        [queryClient, organization.id, sessionId],
    );
}
