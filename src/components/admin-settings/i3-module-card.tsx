/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Controller, useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { useOrganizationSettingsMutation } from "@/components/admin-settings/settings-scope";
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

export function I3Module_SettingsCard({
    organizationId,
    settings,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
}) {
    const form = useForm({
        resolver: zodResolver(OrganizationSettings.schema.shape.modules.shape.i3),
        defaultValues: settings.modules.i3,
    });

    const mutation = useOrganizationSettingsMutation({
        organizationId,
        errorMessage: "Failed to update I3 module settings",
        onSaved: (updated) => form.reset(updated.modules.i3),
    });

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId,
            settings: { ...settings, modules: { ...settings.modules, i3: formData } },
        });
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>I3 Module</CardTitle>
                <CardDescription>
                    The I3 module provides tools to manage individually issued items (I3s) within
                    your organization.
                </CardDescription>
                <CardAction>
                    <Controller
                        control={form.control}
                        name="enabled"
                        render={({ field }) => (
                            <Switch
                                id="i3-module-enabled"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </CardAction>
            </CardHeader>
            <CardContent>
                <form id="i3-module-settings-form" onSubmit={handleSubmit}>
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
                    form="i3-module-settings-form"
                    status={mutation.status}
                    text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    disabled={mutation.status !== "idle"}
                />
            </CardFooter>
        </Card>
    );
}
