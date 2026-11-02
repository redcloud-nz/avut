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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useLogger } from "@/hooks/use-logger";
import { trpc } from "@/trpc/client";
import type { RouterOutput } from "@/trpc/routers/_app";

type PersonalAccessToken = RouterOutput["d4hAccessTokens"]["listPersonalAccessTokens"][number];

type EditD4HAccessTokenDialogProps = Omit<ComponentProps<typeof Dialog>, "children"> & {
    token: PersonalAccessToken;
};

export function UserSettings_EditD4HAccessToken_Dialog({
    token,
    ...props
}: EditD4HAccessTokenDialogProps) {
    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit D4H Access Token</DialogTitle>
                    <DialogDescription>
                        Change the label. To change the token itself, use Replace token value.
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
    token: PersonalAccessToken;
    onDone: () => void;
}) {
    const logger = useLogger("Common", "UserSettings_EditD4HAccessToken_Dialog");

    const formId = useId();
    const form = useForm({
        resolver: zodResolver(
            z.object({
                label: z.string().min(1, "Label is required"),
            }),
        ),
        defaultValues: { label: token.label },
    });

    const mutation = useMutation(
        trpc.d4hAccessTokens.updatePersonalAccessToken.mutationOptions({
            meta: { effects: d4hAccessTokensEffects.updatePersonalAccessToken },
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
            // Nothing changed: the server rejects an empty patch, so just close.
            if (formData.label === token.label) {
                onDone();
                return;
            }

            mutation.mutate({
                organizationId: token.organization.id,
                tokenId: token.id,
                patch: { label: formData.label },
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
