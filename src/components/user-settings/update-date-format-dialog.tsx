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
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useUserSettingsMutation } from "@/components/user-settings/use-user-settings-mutation";
import { DATE_FORMAT_PATTERNS } from "@/lib/datetime";
import { UserSettings } from "@/lib/schemas/user-settings";

/** A fixed example instant, used only to render a live preview of each format preset. */
const PREVIEW_DATE = new Date(2026, 8, 24, 14, 30);

const DATE_FORMAT_LABELS: Record<keyof typeof DATE_FORMAT_PATTERNS, string> = {
    "iso-basic": "ISO Basic",
    "iso-extended": "ISO Extended",
    "iso-ordinal": "ISO Ordinal",
    slash: "Slash",
    dot: "Dot",
    written: "Written",
};

/** `?action=update-date-format` — self-triggered (Recipe A): the trigger button lives here. */
export function UserDisplay_UpdateDateFormat_Dialog({ settings }: { settings: UserSettings }) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update-date-format"] as const),
    );
    const dialogOpen = action === "update-date-format";

    const form = useForm({
        resolver: zodResolver(UserSettings.schema.shape.display.pick({ dateFormat: true })),
        defaultValues: { dateFormat: settings.display.dateFormat },
    });

    const mutation = useUserSettingsMutation({
        errorMessage: "Failed to update date format",
        onSaved: (updated) => {
            form.reset({ dateFormat: updated.display.dateFormat });
            handleDialogOpenChange(false);
        },
    });

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update-date-format" : null, {
            history: open ? "push" : "replace",
        });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset({ dateFormat: settings.display.dateFormat });
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit(({ dateFormat }) => {
        mutation.mutate({
            settings: { ...settings, display: { ...settings.display, dateFormat } },
        });
    });

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Edit date format">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Date Format</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <form id="update-date-format-form" onSubmit={handleSubmit}>
                        <Controller
                            control={form.control}
                            name="dateFormat"
                            render={({ field }) => (
                                <RadioGroup value={field.value} onValueChange={field.onChange}>
                                    {(
                                        Object.keys(
                                            DATE_FORMAT_PATTERNS,
                                        ) as (keyof typeof DATE_FORMAT_PATTERNS)[]
                                    ).map((preset) => (
                                        <Field key={preset} orientation="horizontal">
                                            <RadioGroupItem
                                                value={preset}
                                                id={`date-format-${preset}`}
                                            />
                                            <FieldContent>
                                                <FieldLabel htmlFor={`date-format-${preset}`}>
                                                    {DATE_FORMAT_LABELS[preset]}
                                                </FieldLabel>
                                                <FieldDescription>
                                                    {format(
                                                        PREVIEW_DATE,
                                                        DATE_FORMAT_PATTERNS[preset],
                                                    )}
                                                </FieldDescription>
                                            </FieldContent>
                                        </Field>
                                    ))}
                                </RadioGroup>
                            )}
                        />
                    </form>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="update-date-format-form"
                        status={mutation.status}
                        text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
