/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate, write } from "@/trpc/mutation-effector";

/**
 * Cache effects for `i3` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const i3Effects = createEffects<"i3">()({
    createTemplate: (vars) => [
        invalidate(trpc.i3.listTemplates.queryFilter({ organizationId: vars.organizationId })),
    ],
    deleteTemplate: (vars) => [
        invalidate(trpc.i3.listTemplates.queryFilter({ organizationId: vars.organizationId })),
        invalidate(trpc.trash.listTrash.queryFilter({ organizationId: vars.organizationId })),
    ],
    restoreTemplateFromTrash: (vars, { updated }) => [
        write(
            trpc.i3.getTemplate.queryKey({
                organizationId: vars.organizationId,
                templateId: vars.templateId,
            }),
            updated,
        ),
        invalidate(trpc.i3.listTemplates.queryFilter({ organizationId: vars.organizationId })),
        invalidate(trpc.trash.listTrash.queryFilter({ organizationId: vars.organizationId })),
    ],
});
