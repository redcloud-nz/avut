/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate, write } from "@/trpc/mutation-effector";

/**
 * Cache effects for `d4hApi` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const d4hApiEffects = createEffects<"d4hApi">()({
    updateEquipmentItem: (vars, updated) => [
        write(
            trpc.d4hApi.getEquipmentItem.queryKey({
                organizationId: vars.organizationId,
                teamId: vars.teamId,
                itemId: vars.itemId,
            }),
            (old) => old && { ...old, item: updated },
        ),
        invalidate(
            trpc.d4hApi.listMemberEquipment.queryFilter({ organizationId: vars.organizationId }),
        ),
        invalidate(
            trpc.d4hApi.listTeamIssuedEquipment.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
        invalidate(
            trpc.d4hApi.listEquipmentKindItems.queryFilter({ organizationId: vars.organizationId }),
        ),
        invalidate(
            trpc.d4hApi.listEquipmentItemContents.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
});
