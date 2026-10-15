/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
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
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from "@/components/ui/input-group";
import { OrganizationId } from "@/lib/schemas/organization";
import {
    OrganizationSettings,
    RUBBISH_BIN_MAX_RETENTION_DAYS,
} from "@/lib/schemas/organization-settings";

import { useOrganizationSettingsMutation } from "./use-organization-settings-mutation";

/**
 * The settings schema's bounds, with messages a person can act on — the shared schema's default
 * for a cleared input is Zod's "expected number, received NaN", and `.int()` would otherwise only
 * ever see whole numbers.
 */
const retentionFormSchema = z.object({
    retentionDays: z
        .number({ error: "Enter a number of days" })
        .int("Enter a whole number of days")
        .min(1, "Keep deleted records for at least 1 day")
        .max(
            RUBBISH_BIN_MAX_RETENTION_DAYS,
            `Keep deleted records for at most ${RUBBISH_BIN_MAX_RETENTION_DAYS} days`,
        ),
});

/**
 * `?action=update-rubbish-bin` — self-triggered (Recipe A): the trigger button lives here. Safe
 * because the Rubbish Bin card renders the same whatever the retention is, so a save never
 * unmounts this dialog.
 */
export function OrganizationSettings_UpdateRubbishBin_Dialog({
    organizationId,
    settings,
    description,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
    /** The retention explanation, shared with the card's row. */
    description: string;
}) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update-rubbish-bin"] as const),
    );
    const dialogOpen = action === "update-rubbish-bin";

    const form = useForm({
        resolver: zodResolver(retentionFormSchema),
        defaultValues: settings.rubbishBin,
    });

    const mutation = useOrganizationSettingsMutation({
        errorMessage: "Failed to update Rubbish bin settings",
        onSaved: (updated) => {
            form.reset(updated.rubbishBin);
            handleDialogOpenChange(false);
        },
    });

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update-rubbish-bin" : null, {
            history: open ? "push" : "replace",
        });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset(settings.rubbishBin);
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit(
        ({ retentionDays }) => {
            mutation.mutate({
                organizationId,
                update: { slice: "rubbishBin", patch: { retentionDays } },
            });
        },
        (errors) => console.error("Form validation errors:", errors),
    );

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Edit Rubbish Bin retention">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rubbish Bin</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <form id="update-rubbish-bin-form" onSubmit={handleSubmit}>
                        <FieldGroup>
                            <Controller
                                control={form.control}
                                name="retentionDays"
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="rubbish-bin-retention-days">
                                            Keep deleted records for
                                        </FieldLabel>
                                        <InputGroup aria-invalid={fieldState.invalid}>
                                            <InputGroupInput
                                                id="rubbish-bin-retention-days"
                                                type="number"
                                                // A cleared input holds NaN; show it as empty
                                                // rather than passing NaN to the DOM.
                                                value={Number.isNaN(field.value) ? "" : field.value}
                                                onChange={(ev) =>
                                                    field.onChange(
                                                        ev.currentTarget.value === ""
                                                            ? NaN
                                                            : Number(ev.currentTarget.value),
                                                    )
                                                }
                                                aria-invalid={fieldState.invalid}
                                            />
                                            <InputGroupAddon align="inline-end">
                                                <InputGroupText>days</InputGroupText>
                                            </InputGroupAddon>
                                        </InputGroup>
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
                    <MutationButton
                        type="submit"
                        form="update-rubbish-bin-form"
                        status={mutation.status}
                        text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
