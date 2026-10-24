/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { I3IssueItemsForm, I3ReturnItemsForm } from "@/lib/forms";
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
    recoverTemplate: (vars, { updated }) => [
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
    returnItem: ({ organizationId }) => [
        invalidate(trpc.d4hTasks.listItemTasks.queryFilter({ organizationId })),
        invalidate(trpc.d4hTasks.listReturnedItemIds.queryFilter({ organizationId })),
        invalidate(trpc.d4hTasks.listOpenTasks.queryFilter({ organizationId })),
        invalidate(trpc.d4hApi.listMemberEquipment.queryFilter({ organizationId })),
        invalidate(trpc.d4hApi.listEquipmentKindItems.queryFilter({ organizationId })),
        invalidate(trpc.d4hApi.listEquipmentItemContents.queryFilter({ organizationId })),
    ],
    // The Issue page navigates back to its list on success, so its call site sets `meta.navigates`.
    submitIssueItemsForm: ({ organizationId }) => [
        // Issuing moves items to their new holders in D4H.
        invalidate(trpc.d4hApi.getEquipmentItem.queryFilter({ organizationId })),
        invalidate(trpc.d4hApi.listMemberEquipment.queryFilter({ organizationId })),
        invalidate(trpc.d4hApi.listEquipmentKindItems.queryFilter({ organizationId })),
        invalidate(trpc.d4hApi.listEquipmentItemContents.queryFilter({ organizationId })),
        invalidate(
            trpc.forms.listDraftFormInstances.queryFilter({
                organizationId,
                formKey: I3IssueItemsForm.formKey,
            }),
        ),
    ],
    // The Return page navigates back to its list on success, so its call site sets `meta.navigates`.
    submitReturnItemsForm: ({ organizationId }) => [
        invalidate(trpc.d4hApi.listMemberEquipment.queryFilter({ organizationId })),
        invalidate(trpc.d4hApi.listEquipmentKindItems.queryFilter({ organizationId })),
        invalidate(trpc.d4hApi.listEquipmentItemContents.queryFilter({ organizationId })),
        invalidate(trpc.d4hTasks.listOpenTasks.queryFilter({ organizationId })),
        invalidate(trpc.d4hTasks.listItemTasks.queryFilter({ organizationId })),
        invalidate(trpc.d4hTasks.listReturnedItemIds.queryFilter({ organizationId })),
        invalidate(
            trpc.forms.listDraftFormInstances.queryFilter({
                organizationId,
                formKey: I3ReturnItemsForm.formKey,
            }),
        ),
    ],
});
