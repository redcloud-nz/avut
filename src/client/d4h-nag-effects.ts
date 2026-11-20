/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate, write } from "@/trpc/mutation-effector";

/**
 * Cache effects for `d4hNag` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const d4hNagEffects = createEffects<"d4hNag">()({
    addOptOut: (vars) => [
        invalidate(trpc.d4hNag.listOptOuts.queryFilter({ organizationId: vars.organizationId })),
    ],
    createRule: (vars) => [
        invalidate(trpc.d4hNag.listRules.queryFilter({ organizationId: vars.organizationId })),
    ],
    // The rule's runs are kept with `ruleId` cleared, so the run queries change too.
    deleteRule: (vars) => [
        invalidate(trpc.d4hNag.listRules.queryFilter({ organizationId: vars.organizationId })),
        invalidate(trpc.d4hNag.listRuns.queryFilter({ organizationId: vars.organizationId })),
        invalidate(trpc.d4hNag.getRun.queryFilter({ organizationId: vars.organizationId })),
    ],
    removeOptOut: (vars) => [
        invalidate(trpc.d4hNag.listOptOuts.queryFilter({ organizationId: vars.organizationId })),
    ],
    // A new run shows in the runs lists and as the rule's latest run.
    runRule: (vars) => [
        invalidate(trpc.d4hNag.listRuns.queryFilter({ organizationId: vars.organizationId })),
        invalidate(trpc.d4hNag.listRules.queryFilter({ organizationId: vars.organizationId })),
        invalidate(
            trpc.d4hNag.getRule.queryFilter({
                organizationId: vars.organizationId,
                ruleId: vars.ruleId,
            }),
        ),
    ],
    setOptOutByToken: (vars, data) => [
        write(trpc.d4hNag.getOptOutByToken.queryKey({ token: vars.token }), data),
    ],
    // `getRule` also carries the paused reason, which an enable or disable changes, so it's
    // refetched rather than written from the bare rule the mutation returns.
    updateRule: (vars) => [
        invalidate(
            trpc.d4hNag.getRule.queryFilter({
                organizationId: vars.organizationId,
                ruleId: vars.ruleId,
            }),
        ),
        invalidate(trpc.d4hNag.listRules.queryFilter({ organizationId: vars.organizationId })),
    ],
});
