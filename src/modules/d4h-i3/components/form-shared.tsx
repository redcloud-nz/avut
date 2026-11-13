/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import type { ReactNode } from "react";

import { useDebouncer } from "@tanstack/react-pacer";
import { useMutation } from "@tanstack/react-query";

import { useSession } from "@/client/auth-queries";
import {
    deleteDraftFormInstanceMutation,
    saveDraftFormInstanceMutation,
} from "@/client/form-queries";
import { Saratoga } from "@/components/blocks/saratoga";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Field, FieldTitle } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreferences } from "@/hooks/use-preferences";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { OrganizationId } from "@/lib/schemas/organization";

/**
 * Shows the signed-in user's name (the "Recorded by" field of an I3 form).
 *
 * @param className - Classes for the name, e.g. to line it up with the field beside it.
 */
export function UserNameFieldValue({ className }: { className?: string }) {
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
        return <div className={className}>{data.user.name}</div>;
    }
}

/**
 * The header of a submitted (read-only) I3 form: the form's title and a "Submitted" badge.
 */
export function SubmittedFormHeader({ title }: { title: string }) {
    return (
        <Saratoga.Header>
            <Saratoga.Title className="flex items-center gap-2">
                {title}
                <Badge variant="secondary">Submitted</Badge>
            </Saratoga.Title>
        </Saratoga.Header>
    );
}

/**
 * One read-only field of a submitted I3 form: its label with the value beneath, laid out like
 * the editable form's fields.
 */
export function SubmittedFormField({ label, children }: { label: string; children: ReactNode }) {
    return (
        <Field>
            <FieldTitle>{label}</FieldTitle>
            <div className="text-sm">{children}</div>
        </Field>
    );
}

/**
 * When a form was submitted (its `updatedAt`), as an absolute date and time in the viewer's
 * display format.
 */
export function SubmittedAtFieldValue({ date }: { date: string }) {
    const { formatDateTime } = usePreferences();

    return <time dateTime={date}>{formatDateTime(date)}</time>;
}

/**
 * Debounced auto-save and delete for a draft form instance.
 *
 * Call `handleChange(getValues())` from the form's change handler and wire `saveStatus` to a
 * `SaveStatusIndicator`. `handleDelete` runs `onDeleting` (to navigate away) and then deletes the draft.
 * Call `cancel()` before submitting, so a pending save can't land after the form is processed.
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

    function cancel() {
        debouncer.cancel();
    }

    return { saveStatus: saveMutation.status, handleChange, handleDelete, cancel };
}
