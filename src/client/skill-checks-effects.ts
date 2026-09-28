/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/**
 * Cache effects for `skillChecks` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
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
});
