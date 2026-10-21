/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { timeZoneOptions } from "@/components/controls/time-zone-options";
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
import { SearchableSelect } from "@/components/ui/searchable-select";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

import { useOrganizationSettingsMutation } from "./use-organization-settings-mutation";

const timeZoneFormSchema = OrganizationSettings.schema.shape.general.pick({ timeZone: true });

/**
 * `?action=update-time-zone` — self-triggered (Recipe A): the trigger button lives here. Safe
 * because the General card renders the same whatever the zone is, so a save never unmounts this
 * dialog.
 */
export function OrganizationSettings_UpdateTimeZone_Dialog({
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
        parseAsStringLiteral(["update-time-zone"] as const),
    );
    const dialogOpen = action === "update-time-zone";

    // Built once per mount: computing the offset for ~400 zones per keystroke would be wasteful.
    const options = useMemo(timeZoneOptions, []);

    const form = useForm({
        resolver: zodResolver(timeZoneFormSchema),
        defaultValues: { timeZone: settings.general.timeZone },
    });

    const mutation = useOrganizationSettingsMutation({
        errorMessage: "Failed to update time zone",
        onSaved: (updated) => {
            form.reset({ timeZone: updated.general.timeZone });
            handleDialogOpenChange(false);
        },
    });

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update-time-zone" : null, {
            history: open ? "push" : "replace",
        });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset({ timeZone: settings.general.timeZone });
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit(
        ({ timeZone }) => {
            mutation.mutate({
                organizationId,
                update: { slice: "general", patch: { timeZone } },
            });
        },
        (errors) => console.warn("Form validation errors:", errors),
    );

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Edit time zone">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Time Zone</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <form id="update-org-time-zone-form" onSubmit={handleSubmit}>
                        <FieldGroup>
                            <Controller
                                control={form.control}
                                name="timeZone"
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor="org-time-zone-select">
                                            Time Zone
                                        </FieldLabel>
                                        <SearchableSelect
                                            id="org-time-zone-select"
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            options={options}
                                            placeholder="Select a time zone"
                                            searchPlaceholder="Search time zones..."
                                            emptyMessage="No time zones found."
                                            aria-invalid={fieldState.invalid}
                                        />
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                            <p className="text-sm text-muted-foreground">
                                Changing the zone does not move sessions already saved, so an
                                existing all-day session will read as a timed one.
                            </p>
                        </FieldGroup>
                    </form>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="update-org-time-zone-form"
                        status={mutation.status}
                        text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
