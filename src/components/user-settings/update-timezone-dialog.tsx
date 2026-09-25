/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";

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
import { Field, FieldLabel } from "@/components/ui/field";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { useUserSettingsMutation } from "@/components/user-settings/use-user-settings-mutation";
import { UserSettings } from "@/lib/schemas/user-settings";

/**
 * Every IANA zone the runtime knows, each with today's UTC offset as its subtitle so a zone can
 * be identified without recognising its name.
 */
function timeZoneOptions(): SearchableSelectOption[] {
    return Intl.supportedValuesOf("timeZone").map((zone) => ({
        value: zone,
        label: zone,
        subtitle: new Intl.DateTimeFormat("en-US", {
            timeZone: zone,
            timeZoneName: "shortOffset",
        })
            .formatToParts(new Date())
            .find((part) => part.type === "timeZoneName")?.value,
    }));
}

/** `?action=update-time-zone` — self-triggered (Recipe A): the trigger button lives here. */
export function UserDisplay_UpdateTimeZone_Dialog({ settings }: { settings: UserSettings }) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update-time-zone"] as const),
    );
    const dialogOpen = action === "update-time-zone";

    // Built once per mount rather than per render — computing the offset for ~400 zones on
    // every keystroke of the search box would be wasteful.
    const options = useMemo(timeZoneOptions, []);

    const form = useForm({
        resolver: zodResolver(UserSettings.schema.shape.display.pick({ timeZone: true })),
        defaultValues: { timeZone: settings.display.timeZone },
    });

    const mutation = useUserSettingsMutation({
        errorMessage: "Failed to update time zone",
        onSaved: (updated) => {
            form.reset({ timeZone: updated.display.timeZone });
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
            form.reset({ timeZone: settings.display.timeZone });
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit(({ timeZone }) => {
        mutation.mutate({ update: { slice: "display", patch: { timeZone } } });
    });

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
                    <DialogDescription>
                        Every date and time in AVUT is rendered in this zone.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <form id="update-time-zone-form" onSubmit={handleSubmit}>
                        <Controller
                            control={form.control}
                            name="timeZone"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="time-zone-select">Time Zone</FieldLabel>
                                    <SearchableSelect
                                        id="time-zone-select"
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        options={options}
                                        placeholder="Select a time zone"
                                        searchPlaceholder="Search time zones..."
                                        emptyMessage="No time zones found."
                                        aria-invalid={fieldState.invalid}
                                    />
                                </Field>
                            )}
                        />
                    </form>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="update-time-zone-form"
                        status={mutation.status}
                        text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
