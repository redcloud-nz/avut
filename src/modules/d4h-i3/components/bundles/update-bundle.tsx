/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { i3BundlesEffects } from "@/client/i3-bundles-effects";
import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { DialogBoundary } from "@/components/ui/dialog-boundary";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RecordCardEditButton } from "@/components/ui/record-card-actions";
import { Textarea } from "@/components/ui/textarea";
import { ObjectName } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";
import { I3Bundle } from "@/lib/schemas/i3-bundle";
import { trpc } from "@/trpc/client";

/**
 * The I3 Bundle card's pencil and the `?action=update` dialog it opens. `primary` on the page's
 * primary record card, so ⌥E opens it.
 */
export function D4HI3Module_UpdateBundle_Dialog({
    bundle,
    primary = false,
}: {
    bundle: I3Bundle;
    primary?: boolean;
}) {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["update"] as const));
    const dialogOpen = action === "update";

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update" : null, { history: open ? "push" : "replace" });
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <RecordCardEditButton label="Edit bundle" category="Bundles" primary={primary} />
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update Bundle</DialogTitle>
                    <DialogDescription>Update the details of this bundle.</DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <UpdateBundle_Body
                        bundle={bundle}
                        onDone={() => handleDialogOpenChange(false)}
                    />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function UpdateBundle_Body({ bundle, onDone }: { bundle: I3Bundle; onDone: () => void }) {
    const organization = useOrganization();

    const formId = useId();
    const form = useForm({
        resolver: zodResolver(I3Bundle.modifiableSchema),
        defaultValues: { name: bundle.name, description: bundle.description },
    });

    const mutation = useMutation(
        trpc.i3Bundles.updateBundle.mutationOptions({
            meta: { effects: i3BundlesEffects.updateBundle },
            onError(error) {
                toast.error(`Failed to update bundle: ${error.message}`);
            },
            onSuccess({ updated }) {
                toast.success(
                    <>
                        Bundle <ObjectName>{updated.name}</ObjectName> updated.
                    </>,
                );
                onDone();
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) =>
            mutation.mutate({
                organizationId: organization.id,
                bundleId: bundle.id,
                update: formData,
            }),
        (errors) => {
            console.warn("Form validation errors:", errors);
        },
    );

    return (
        <>
            <DialogBody>
                <form id={formId} onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={`${formId}-name`}>Name</FieldLabel>
                                    <Input
                                        id={`${formId}-name`}
                                        autoComplete="off"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="description"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={`${formId}-description`}>
                                        Description
                                    </FieldLabel>
                                    <Textarea
                                        id={`${formId}-description`}
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    type="submit"
                    form={formId}
                    status={mutation.status}
                    text={{
                        idle: "Update",
                        pending: "Updating",
                        success: "Updated",
                    }}
                />
            </DialogFooter>
        </>
    );
}
