/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { TrashableEntityId } from "@/lib/trash-registry";
import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/**
 * The router whose queries a recovered or purged record of each type can appear in. A trash
 * mutation serves every entity type, so it can't `write()` one typed detail query the way the
 * per-entity `recoverX` effects do — it invalidates the owning router's queries wholesale.
 */
const owningRouter = {
    person: () => trpc.personnel.pathFilter(),
    team: () => trpc.teams.pathFilter(),
    teamMembership: () => trpc.teams.pathFilter(),
    i3Template: () => trpc.i3.pathFilter(),
    skillPackage: () => trpc.skillPackageBuilder.pathFilter(),
    skillGroup: () => trpc.skillPackageBuilder.pathFilter(),
    skill: () => trpc.skillPackageBuilder.pathFilter(),
} satisfies Record<TrashableEntityId, () => unknown>;

const trashCaches = (vars: { organizationId: string; type: TrashableEntityId }) => [
    invalidate(trpc.trash.listTrash.queryFilter({ organizationId: vars.organizationId })),
    invalidate(owningRouter[vars.type]()),
];

/**
 * Cache effects for `trash` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const trashEffects = createEffects<"trash">()({
    purgeRecord: (vars) => trashCaches(vars),
    recoverRecord: (vars) => trashCaches(vars),
});
