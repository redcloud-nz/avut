/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { createEffects, invalidate, write } from "@/trpc/mutation-effector";
import { trpc } from "@/trpc/client";

/**
 * Cache effects for `skillChecks` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `MutationInvalidator`.
 */
export const skillChecksEffects = createEffects<"skillChecks">()({
    createSkillCheck: (vars) => [
        // A standalone check adds a row to the recent-checks list and to any scoped
        // listSkillChecks cache (e.g. the session matrices), so both need to refetch.
        invalidate(
            trpc.skillChecks.listRecentChecks.queryFilter({ organizationId: vars.organizationId }),
        ),
        invalidate(
            trpc.skillChecks.listSkillChecks.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],

    approveSession: (vars, { updated }) => [
        write(
            trpc.skills.getSession.queryKey({
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
});
