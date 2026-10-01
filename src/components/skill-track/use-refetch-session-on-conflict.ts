/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useCallback } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { useOrganization } from "@/hooks/use-organization";
import type { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

/**
 * Returns an `onError` helper for a mutation that writes a skill check session's checks or config,
 * or approves it. A `CONFLICT` from one of those means the session changed under the page: it was
 * approved (the approval lock); for `approveSession`, the session or its checks no longer match
 * what the page showed; or, for `updateCheckExclusions`, a check the mutation names was deleted
 * since. So it invalidates the session's `getSession` and its `listSkillChecks`: the page picks
 * up the approval and turns read-only, or shows the checks as they are now. Any other error is
 * left alone.
 *
 * `meta.effects` only runs on success, which is why this is done by hand.
 */
export function useRefetchSessionOnConflict(sessionId: SkillCheckSessionId) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    return useCallback(
        (error: { data?: { code?: string } | null }) => {
            if (error.data?.code !== "CONFLICT") return;
            void queryClient.invalidateQueries(
                trpc.skillCheckSessions.getSession.queryFilter({
                    organizationId: organization.id,
                    skillCheckSessionId: sessionId,
                }),
            );
            void queryClient.invalidateQueries(
                trpc.skillChecks.listSkillChecks.queryFilter({
                    organizationId: organization.id,
                    sessionId,
                }),
            );
        },
        [queryClient, organization.id, sessionId],
    );
}
