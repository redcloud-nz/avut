/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps, useId } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { d4hAccessTokensEffects } from "@/client/d4h-access-tokens-effects";
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
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import { ProviderCredentialAccess } from "@/lib/schemas/provider-credential";
import { trpc } from "@/trpc/client";
import type { RouterOutput } from "@/trpc/routers/_app";

type OrganizationAccessToken = RouterOutput["d4hAccessTokens"]["getOrganizationAccessToken"];

type EditD4HAccessTokenDialogProps = Omit<ComponentProps<typeof Dialog>, "children"> & {
    token: OrganizationAccessToken;
};

export function AdminModule_EditD4HAccessToken_Dialog({
    token,
    ...props
}: EditD4HAccessTokenDialogProps) {
    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit D4H Access Token</DialogTitle>
                    <DialogDescription>
                        Change the label or access level. To change the token itself, use Replace
                        token value.
                    </DialogDescription>
                </DialogHeader>
                <EditD4HAccessToken_Body token={token} onDone={() => props.onOpenChange?.(false)} />
            </DialogContent>
        </Dialog>
    );
}

function EditD4HAccessToken_Body({
    token,
    onDone,
}: {
    token: OrganizationAccessToken;
    onDone: () => void;
}) {
    const logger = useLogger("Common", "AdminModule_EditD4HAccessToken_Dialog");
    const organization = useOrganization();

    const formId = useId();
    const form = useForm({
        resolver: zodResolver(
            z.object({
                label: z.string().min(1, "Label is required"),
                access: ProviderCredentialAccess.schema,
            }),
        ),
        defaultValues: { label: token.label, access: token.access },
    });

    const mutation = useMutation(
        trpc.d4hAccessTokens.updateOrganizationAccessToken.mutationOptions({
            meta: { effects: d4hAccessTokensEffects.updateOrganizationAccessToken },
            onError(error) {
                logger.error("Error updating D4H access token:", error);
                toast.error(`Failed to update D4H access token: ${error.message}`);
            },
            onSuccess() {
                toast.success("D4H access token updated");
                onDone();
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) => {
            const patch = {
                ...(formData.label !== token.label && { label: formData.label }),
                ...(formData.access !== token.access && { access: formData.access }),
            };

            // Nothing changed: the server rejects an empty patch, so just close.
            if (Object.keys(patch).length === 0) {
                onDone();
                return;
            }

            mutation.mutate({
                organizationId: organization.id,
                tokenId: token.id,
                patch,
            });
        },
        (error) => {
            logger.warn("Form validation failed", error);
        },
    );

    return (
        <>
            <DialogBody>
                <form id={formId} onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="label"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="edit-access-token-label">Label</FieldLabel>
                                    <Input
                                        id="edit-access-token-label"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="access"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="edit-access-token-access">
                                        Access
                                    </FieldLabel>
                                    <Select {...field} onValueChange={field.onChange}>
                                        <SelectTrigger
                                            id="edit-access-token-access"
                                            aria-invalid={fieldState.invalid}
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ProviderCredentialAccess.schema.options.map(
                                                (access) => (
                                                    <SelectItem key={access} value={access}>
                                                        {ProviderCredentialAccess.labels[access]}
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                    <FieldDescription>
                                        Read only stops AVUT from making any change in D4H with this
                                        token.
                                    </FieldDescription>
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
                    text={{ idle: "Save", pending: "Saving", success: "Saved" }}
                />
            </DialogFooter>
        </>
    );
}
