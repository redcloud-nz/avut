/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/**
 * Cache effects for `d4hTasks` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const d4hTasksEffects = createEffects<"d4hTasks">()({
    checkTask: (vars) => invalidateTaskLists(vars.organizationId),
    dismissTask: (vars) => invalidateTaskLists(vars.organizationId),
});

function invalidateTaskLists(organizationId: string) {
    return [
        invalidate(trpc.d4hTasks.listOpenTasks.queryFilter({ organizationId })),
        invalidate(trpc.d4hTasks.listItemTasks.queryFilter({ organizationId })),
        invalidate(trpc.d4hTasks.listReturnedItemIds.queryFilter({ organizationId })),
    ];
}
