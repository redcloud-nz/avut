/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useId } from "react";
import { Controller, useForm } from "react-hook-form";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";

import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

import { useOrganizationSettingsMutation } from "./use-organization-settings-mutation";

/** An empty field saves as `null` (no Reply-To), the same as Clear. */
const replyToFormSchema = z.object({
    replyTo: z.union([z.literal(""), z.email("Enter a valid email address")]),
});

/**
 * `?action=update-reply-to` — self-triggered (Recipe A): the trigger button lives here. Safe
 * because the General card renders the same whatever the address is, so a save never unmounts
 * this dialog.
 */
export function OrganizationSettings_UpdateReplyTo_Dialog({
    organizationId,
    settings,
    description,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
    /** The setting's explanation, shared with the card's row. */
    description: string;
}) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update-reply-to"] as const),
    );
    const dialogOpen = action === "update-reply-to";

    const inputId = useId();
    const formId = useId();
    const form = useForm({
        resolver: zodResolver(replyToFormSchema),
        defaultValues: { replyTo: settings.general.replyTo ?? "" },
    });

    const mutation = useOrganizationSettingsMutation({
        errorMessage: "Failed to update the Reply-To address",
        onSaved: (updated) => {
            form.reset({ replyTo: updated.general.replyTo ?? "" });
            handleDialogOpenChange(false);
        },
    });

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update-reply-to" : null, {
            history: open ? "push" : "replace",
        });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset({ replyTo: settings.general.replyTo ?? "" });
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    function save(replyTo: string | null) {
        mutation.mutate({
            organizationId,
            update: { slice: "general", patch: { replyTo } },
        });
    }

    const handleSubmit = form.handleSubmit(
        ({ replyTo }) => save(replyTo === "" ? null : replyTo),
        (errors) => console.warn("Form validation errors:", errors),
    );

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Edit Reply-To address">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Reply-To Address</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <form id={formId} onSubmit={handleSubmit}>
                        <FieldGroup>
                            <Controller
                                control={form.control}
                                name="replyTo"
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={inputId}>Reply-To Address</FieldLabel>
                                        <Input
                                            {...field}
                                            id={inputId}
                                            type="email"
                                            placeholder="training@example.org"
                                            autoComplete="off"
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                        </FieldGroup>
                    </form>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={settings.general.replyTo === null || mutation.isPending}
                        onClick={() => save(null)}
                    >
                        Clear
                    </Button>
                    <MutationButton
                        type="submit"
                        form={formId}
                        status={mutation.status}
                        text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
