/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Controller, useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useUserSettingsMutation } from "@/components/user-settings/use-user-settings-mutation";
import { userModules as allUserModules, configurableUserModuleIds } from "@/lib/modules";
import { UserSettings } from "@/lib/schemas/user-settings";

const userModules = allUserModules.filter((m) => configurableUserModuleIds.includes(m.id));

/**
 * Per-user module preferences — mirrors the organization settings "Modules" section, keyed by
 * `UserModuleId` instead of `OrganizationModuleId`. Renders nothing while
 * `configurableUserModuleIds` is empty (every user module is currently `alwaysOn`, see
 * `src/lib/modules.ts`) rather than showing switches that don't gate anything — this is the
 * scaffolding for per-module preferences called for in issue #93, ready for the first module
 * that actually needs one.
 */
export function UserModules_SettingsCard({ settings }: { settings: UserSettings }) {
    const form = useForm({
        resolver: zodResolver(UserSettings.schema.shape.modules),
        defaultValues: settings.modules,
    });

    const mutation = useUserSettingsMutation({
        errorMessage: "Failed to update module settings",
        onSaved: (updated) => form.reset(updated.modules),
    });

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({ settings: { ...settings, modules: formData } });
    });

    if (userModules.length === 0) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Modules</CardTitle>
            </CardHeader>
            <CardContent>
                <form id="user-modules-settings-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        {userModules.map((module, index) => (
                            <div key={module.id}>
                                <Field orientation="horizontal">
                                    <FieldContent>
                                        <FieldLabel htmlFor={`${module.id}-module-enabled`}>
                                            {module.label}
                                        </FieldLabel>
                                    </FieldContent>
                                    <Controller
                                        control={form.control}
                                        name={`${module.id}.enabled`}
                                        render={({ field }) => (
                                            <Switch
                                                id={`${module.id}-module-enabled`}
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        )}
                                    />
                                </Field>
                                {index < userModules.length - 1 && <FieldSeparator />}
                            </div>
                        ))}
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
                    form="user-modules-settings-form"
                    status={mutation.status}
                    text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    disabled={mutation.status !== "idle"}
                />
            </CardFooter>
        </Card>
    );
}
