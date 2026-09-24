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
import { TIME_FORMAT_PATTERNS } from "@/lib/datetime";
import { UserSettings } from "@/lib/schemas/user-settings";

/** A fixed example instant, used only to render a live preview of each format preset. */
const PREVIEW_DATE = new Date(2026, 8, 24, 14, 30);

const TIME_FORMAT_LABELS: Record<keyof typeof TIME_FORMAT_PATTERNS, string> = {
    "12-hour": "12-hour",
    "24-hour": "24-hour",
};

/** `?action=update-time-format` — self-triggered (Recipe A): the trigger button lives here. */
export function UserDisplay_UpdateTimeFormat_Dialog({ settings }: { settings: UserSettings }) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update-time-format"] as const),
    );
    const dialogOpen = action === "update-time-format";

    const form = useForm({
        resolver: zodResolver(UserSettings.schema.shape.display.pick({ timeFormat: true })),
        defaultValues: { timeFormat: settings.display.timeFormat },
    });

    const mutation = useUserSettingsMutation({
        errorMessage: "Failed to update time format",
        onSaved: (updated) => {
            form.reset({ timeFormat: updated.display.timeFormat });
            handleDialogOpenChange(false);
        },
    });

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update-time-format" : null, {
            history: open ? "push" : "replace",
        });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset({ timeFormat: settings.display.timeFormat });
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit(({ timeFormat }) => {
        mutation.mutate({
            settings: { ...settings, display: { ...settings.display, timeFormat } },
        });
    });

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Edit time format">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Time Format</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <form id="update-time-format-form" onSubmit={handleSubmit}>
                        <Controller
                            control={form.control}
                            name="timeFormat"
                            render={({ field }) => (
                                <RadioGroup value={field.value} onValueChange={field.onChange}>
                                    {(
                                        Object.keys(
                                            TIME_FORMAT_PATTERNS,
                                        ) as (keyof typeof TIME_FORMAT_PATTERNS)[]
                                    ).map((preset) => (
                                        <Field key={preset} orientation="horizontal">
                                            <RadioGroupItem
                                                value={preset}
                                                id={`time-format-${preset}`}
                                            />
                                            <FieldContent>
                                                <FieldLabel htmlFor={`time-format-${preset}`}>
                                                    {TIME_FORMAT_LABELS[preset]}
                                                </FieldLabel>
                                                <FieldDescription>
                                                    {format(
                                                        PREVIEW_DATE,
                                                        TIME_FORMAT_PATTERNS[preset],
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
                        form="update-time-format-form"
                        status={mutation.status}
                        text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
