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
 * Returns an `onError` helper for a mutation that writes a skill check session's checks or config.
 * A `CONFLICT` from one of those means the session was approved under the page (the approval lock),
 * so it invalidates the session's `getSession`: the page picks up the approval and turns
 * read-only. Any other error is left alone.
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
        },
        [queryClient, organization.id, sessionId],
    );
}
