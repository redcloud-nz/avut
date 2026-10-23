/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation } from "@tanstack/react-query";

import { useSession } from "@/client/auth-queries";
import {
    deleteDraftFormInstanceMutation,
    saveDraftFormInstanceMutation,
} from "@/client/form-queries";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { OrganizationId } from "@/lib/schemas/organization";

/**
 * Shows the signed-in user's name (the "Issuer" / "Received by" field of an I3 form).
 */
export function UserNameFieldValue() {
    const { data, error, isPending } = useSession();

    if (isPending) {
        return <Skeleton className="min-w-1/2 h-8" />;
    } else if (error) {
        return (
            <Alert variant="warning" className="min-w-1/2">
                <AlertTitle>Unable to load user information.</AlertTitle>
            </Alert>
        );
    } else if (data) {
        return <div>{data.user.name}</div>;
    }
}

/**
 * Debounced auto-save and delete for a draft form instance.
 *
 * Call `handleChange(getValues())` from the form's change handler and wire `saveStatus` to a
 * `SaveStatusIndicator`. `handleDelete` runs `onDeleting` (to navigate away) and then deletes the draft.
 */
export function useDraftFormAutosave({
    formKey,
    instanceId,
    organizationId,
    onDeleting,
}: {
    formKey: string;
    instanceId: FormInstanceId;
    organizationId: OrganizationId;
    onDeleting: () => void;
}) {
    const saveMutation = useMutation(saveDraftFormInstanceMutation());
    const deleteMutation = useMutation(deleteDraftFormInstanceMutation());

    const debouncer = useDebouncer(
        (formData: Record<string, unknown>) => {
            saveMutation.mutate({
                formInstanceId: instanceId,
                organizationId,
                formKey,
                formData,
            });
        },
        { wait: 2000 },
    );

    function handleDelete() {
        onDeleting();
        deleteMutation.mutate({ formInstanceId: instanceId, organizationId, formKey });
    }

    function handleChange(formData: Record<string, unknown>) {
        // Reset the mutation state
        if (saveMutation.status == "success") {
            saveMutation.reset();
        }

        // Trigger the debounced mutation to save form data
        debouncer.maybeExecute(formData);
    }

    return { saveStatus: saveMutation.status, handleChange, handleDelete };
}
