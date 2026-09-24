/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { format } from "date-fns";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useUserSettingsMutation } from "@/components/user-settings/use-user-settings-mutation";
import { DATE_FORMAT_PATTERNS, DATE_TIME_FORMAT_PATTERNS } from "@/lib/datetime";
import { UserSettings } from "@/lib/schemas/user-settings";

/** A fixed example instant, used only to render a live preview of each format preset. */
const PREVIEW_DATE = new Date(2026, 8, 24, 14, 30);

/** `?action=update-display` — self-triggered (Recipe A): the trigger button lives in this dialog. */
export function UserDisplay_UpdateSettings_Dialog({ settings }: { settings: UserSettings }) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update-display"] as const),
    );
    const dialogOpen = action === "update-display";

    const form = useForm({
        resolver: zodResolver(UserSettings.schema.shape.display),
        defaultValues: settings.display,
    });

    const mutation = useUserSettingsMutation({
        errorMessage: "Failed to update display settings",
        onSaved: (updated) => {
            form.reset(updated.display);
            handleDialogOpenChange(false);
        },
    });

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update-display" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset(settings.display);
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({ settings: { ...settings, display: formData } });
    });

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Edit display settings">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Display</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <form id="update-display-settings-form" onSubmit={handleSubmit}>
                        <FieldGroup>
                            <Controller
                                control={form.control}
                                name="dateFormat"
                                render={({ field }) => (
                                    <Field>
                                        <FieldLabel htmlFor="date-format">Table dates</FieldLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger id="date-format">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(
                                                    Object.keys(
                                                        DATE_FORMAT_PATTERNS,
                                                    ) as (keyof typeof DATE_FORMAT_PATTERNS)[]
                                                ).map((preset) => (
                                                    <SelectItem key={preset} value={preset}>
                                                        {format(
                                                            PREVIEW_DATE,
                                                            DATE_FORMAT_PATTERNS[preset],
                                                        )}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                )}
                            />
                            <Controller
                                control={form.control}
                                name="dateTimeFormat"
                                render={({ field }) => (
                                    <Field>
                                        <FieldLabel htmlFor="date-time-format">
                                            Created/updated times
                                        </FieldLabel>
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger id="date-time-format">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(
                                                    Object.keys(
                                                        DATE_TIME_FORMAT_PATTERNS,
                                                    ) as (keyof typeof DATE_TIME_FORMAT_PATTERNS)[]
                                                ).map((preset) => (
                                                    <SelectItem key={preset} value={preset}>
                                                        {format(
                                                            PREVIEW_DATE,
                                                            DATE_TIME_FORMAT_PATTERNS[preset],
                                                        )}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
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
                        form="update-display-settings-form"
                        status={mutation.status}
                        text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
