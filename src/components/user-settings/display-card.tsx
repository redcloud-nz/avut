/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { format } from "date-fns";
import { Controller, useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
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

/**
 * Per-user display preferences — currently just the two date-format presets called for in
 * issue #93 (`dateFormat` for table/list columns, `dateTimeFormat` for fuller contexts like
 * entity created/updated times). Not yet wired into `formatDate`/`formatDateTime` — see those
 * functions' docstrings in `src/lib/datetime.ts`.
 */
export function UserDisplay_SettingsCard({ settings }: { settings: UserSettings }) {
    const form = useForm({
        resolver: zodResolver(UserSettings.schema.shape.display),
        defaultValues: settings.display,
    });

    const mutation = useUserSettingsMutation({
        errorMessage: "Failed to update display settings",
        onSaved: (updated) => form.reset(updated.display),
    });

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({ settings: { ...settings, display: formData } });
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Display</CardTitle>
            </CardHeader>
            <CardContent>
                <form id="user-display-settings-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Field orientation="horizontal">
                            <FieldContent>
                                <FieldLabel htmlFor="date-format">Table dates</FieldLabel>
                            </FieldContent>
                            <Controller
                                control={form.control}
                                name="dateFormat"
                                render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger id="date-format" className="w-[200px]">
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
                                )}
                            />
                        </Field>
                        <FieldSeparator />
                        <Field orientation="horizontal">
                            <FieldContent>
                                <FieldLabel htmlFor="date-time-format">
                                    Created/updated times
                                </FieldLabel>
                            </FieldContent>
                            <Controller
                                control={form.control}
                                name="dateTimeFormat"
                                render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger id="date-time-format" className="w-[200px]">
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
                                )}
                            />
                        </Field>
                    </FieldGroup>
                </form>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                {form.formState.isDirty && (
                    <Button variant="ghost" type="button" onClick={() => form.reset()}>
                        Reset
                    </Button>
                )}
                <MutationButton
                    form="user-display-settings-form"
                    status={mutation.status}
                    text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    disabled={mutation.status !== "idle"}
                />
            </CardFooter>
        </Card>
    );
}
