/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Controller, useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { useOrganizationSettingsMutation } from "@/components/admin/organization-settings/use-organization-settings-mutation";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

export function NotesModule_SettingsCard({
    organizationId,
    settings,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
}) {
    const form = useForm({
        resolver: zodResolver(OrganizationSettings.schema.shape.modules.shape.notes),
        defaultValues: settings.modules.notes,
    });

    const mutation = useOrganizationSettingsMutation({
        errorMessage: "Failed to update Notes module settings",
        onSaved: (updated) => form.reset(updated.modules.notes),
    });

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({ organizationId, update: { slice: "modules.notes", patch: formData } });
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Notes Module</CardTitle>
                <CardDescription>
                    The Notes module gives your organisation a shared place for markdown notes.
                </CardDescription>
                <CardAction>
                    <Controller
                        control={form.control}
                        name="enabled"
                        render={({ field }) => (
                            <Switch
                                id="notes-module-enabled"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </CardAction>
            </CardHeader>
            <CardContent>
                <form id="notes-module-settings-form" onSubmit={handleSubmit}>
                    <FieldGroup></FieldGroup>
                </form>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                {form.formState.isDirty && (
                    <Button variant="ghost" type="button" onClick={() => form.reset()}>
                        Reset
                    </Button>
                )}
                <MutationButton
                    form="notes-module-settings-form"
                    status={mutation.status}
                    text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    disabled={mutation.status !== "idle"}
                />
            </CardFooter>
        </Card>
    );
}
