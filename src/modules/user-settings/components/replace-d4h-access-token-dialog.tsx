/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps, useId, type RefObject } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { useLogger } from "@/hooks/use-logger";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { OrganizationId } from "@/lib/schemas/organization";
import { ProviderCredentialId } from "@/lib/schemas/provider-credential";
import { trpc } from "@/trpc/client";

type ReplaceD4HAccessTokenDialogProps = Omit<ComponentProps<typeof Dialog>, "children"> & {
    tokenId: ProviderCredentialId;
    organizationId: OrganizationId;
    /** Where focus goes on close when the control that opened the dialog is gone (a menu item). */
    returnFocusRef?: RefObject<HTMLElement | null>;
};

export function UserSettings_ReplaceD4HAccessToken_Dialog({
    tokenId,
    organizationId,
    returnFocusRef,
    ...props
}: ReplaceD4HAccessTokenDialogProps) {
    const returnFocus = useReturnFocus(returnFocusRef);

    return (
        <Dialog {...props}>
            <DialogContent {...returnFocus}>
                <DialogHeader>
                    <DialogTitle>Replace Token Value</DialogTitle>
                    <DialogDescription>
                        Paste a new D4H token to use in place of the current one. The token&apos;s
                        id and everything linked to it are kept, so nothing that uses it needs
                        setting up again.
                    </DialogDescription>
                </DialogHeader>
                <ReplaceD4HAccessToken_Body
                    tokenId={tokenId}
                    organizationId={organizationId}
                    onDone={() => props.onOpenChange?.(false)}
                />
            </DialogContent>
        </Dialog>
    );
}

function ReplaceD4HAccessToken_Body({
    tokenId,
    organizationId,
    onDone,
}: {
    tokenId: ProviderCredentialId;
    organizationId: OrganizationId;
    onDone: () => void;
}) {
    const logger = useLogger("Common", "UserSettings_ReplaceD4HAccessToken_Dialog");

    const formId = useId();
    const form = useForm({
        resolver: zodResolver(z.object({ token: z.string().trim().min(1, "Token is required") })),
        defaultValues: { token: "" },
    });

    const mutation = useMutation(
        trpc.d4hAccessTokens.replacePersonalAccessToken.mutationOptions({
            meta: { effects: d4hAccessTokensEffects.replacePersonalAccessToken },
            onError(error) {
                logger.error("Error replacing D4H access token value:", error);
                toast.error(`Failed to replace token value: ${error.message}`);
            },
            onSuccess() {
                toast.success("D4H access token value replaced");
                onDone();
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) => {
            mutation.mutate({
                organizationId,
                tokenId,
                token: formData.token,
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
                            name="token"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={`${formId}-token`}>Token</FieldLabel>
                                    <Textarea
                                        id={`${formId}-token`}
                                        aria-invalid={fieldState.invalid}
                                        placeholder="Paste new token here"
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
                    text={{ idle: "Replace", pending: "Replacing", success: "Replaced" }}
                />
            </DialogFooter>
        </>
    );
}
