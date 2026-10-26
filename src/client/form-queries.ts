/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { toast } from "sonner";

import { trpc } from "@/trpc/client";

/**
 * Creates a draft form instance. The caller opens the new draft from `onSuccess`.
 *
 * Unlike save and delete, there's no optimistic update: an optimistic row in the drafts list
 * would show up well before the draft's own page opens, so the click would look like it only
 * added a row. The saved draft still goes into the cached list before `onSuccess` runs, because
 * the draft's page reads it from there: the server's copy, already cached, is only hydrated after
 * that page's first render.
 */
export function newFormInstanceMutation(
    mutationOptions: Parameters<typeof trpc.forms.saveFormInstanceData.mutationOptions>[0] = {},
) {
    return trpc.forms.saveFormInstanceData.mutationOptions({
        ...mutationOptions,
        onSuccess(formInstance, data, result, context) {
            context.client.setQueryData(
                trpc.forms.listDraftFormInstances.queryKey({
                    organizationId: data.organizationId,
                    formKey: data.formKey,
                }),
                (old = []) => [...old, formInstance],
            );

            return mutationOptions.onSuccess?.(formInstance, data, result, context);
        },
        onError(error, data, result, context) {
            console.error("Error creating form instance:", error);
            toast.error(`Failed to create form instance: ${error.message}`);

            if (mutationOptions.onError) mutationOptions.onError(error, data, result, context);
        },
    });
}

export function saveDraftFormInstanceMutation() {
    return trpc.forms.saveFormInstanceData.mutationOptions({
        async onMutate(data, context) {
            const queryKey = trpc.forms.listDraftFormInstances.queryKey({
                organizationId: data.organizationId,
                formKey: data.formKey,
            });

            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await context.client.cancelQueries({ queryKey });

            // Snapshot the previous value
            const previous = context.client.getQueryData(queryKey);

            // Optimistically update to the new value
            context.client.setQueryData(queryKey, (old = []) =>
                old.map((inst) => {
                    if (inst.id === data.formInstanceId) {
                        return {
                            ...inst,
                            formData: data.formData,
                            updatedAt: new Date().toISOString(),
                        };
                    }
                    return inst;
                }),
            );

            // Return a context object with the snapshotted value
            return { client: context.client, previous };
        },
        onError(error, data, context) {
            const queryKey = trpc.forms.listDraftFormInstances.queryKey({
                organizationId: data.organizationId,
                formKey: data.formKey,
            });

            if (context?.previous) {
                context.client.setQueryData(queryKey, context.previous);
            }

            console.error("Failed to save form data: ", error);
            toast.error(`Failed to save form data: ${error.message}`);
        },
    });
}

export function deleteDraftFormInstanceMutation() {
    return trpc.forms.deleteFormInstance.mutationOptions({
        async onMutate(data, context) {
            const queryKey = trpc.forms.listDraftFormInstances.queryKey({
                organizationId: data.organizationId,
                formKey: data.formKey,
            });

            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await context.client.cancelQueries({ queryKey });

            // Snapshot the previous value
            const previous = context.client.getQueryData(queryKey);

            // Optimistically update to the new value
            context.client.setQueryData(queryKey, (old = []) =>
                old.map((inst) => {
                    if (inst.id === data.formInstanceId) {
                        return {
                            ...inst,
                            deleted: true,
                        };
                    }
                    return inst;
                }),
            );

            // Return a context object with the snapshotted value
            return { client: context.client, previous };
        },
        onError(error, data, context) {
            const queryKey = trpc.forms.listDraftFormInstances.queryKey({
                organizationId: data.organizationId,
                formKey: data.formKey,
            });

            if (context?.previous) {
                context.client.setQueryData(queryKey, context.previous);
            }

            console.error("Failed to delete form instance: ", error);
            toast.error(`Failed to delete form instance: ${error.message}`);
        },
        async onSettled(data, error, variables, context) {
            const queryKey = trpc.forms.listDraftFormInstances.queryKey({
                organizationId: variables.organizationId,
                formKey: variables.formKey,
            });
            await context?.client.invalidateQueries({ queryKey });
        },
    });
}
