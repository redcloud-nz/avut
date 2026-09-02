/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Control, Controller, useForm, useWatch } from "react-hook-form";

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
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldLegend,
    FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { SKILL_CHECK_RESULT_VALUES, SkillCheckResultValue } from "@/lib/schemas/skill-check";

// Exempt, Expired, and Provisional exist in the fixed vocabulary but aren't offered to
// organizations yet — their semantics aren't settled. Remove from this list to enable them.
const SKILL_TRACK_CONFIGURABLE_RESULT_VALUES = SKILL_CHECK_RESULT_VALUES.filter(
    (value) => value !== "Exempt" && value !== "Expired" && value !== "Provisional",
);

export function SkillTrackModule_SettingsCard({
    organizationId,
    settings,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
}) {
    const form = useForm({
        resolver: zodResolver(OrganizationSettings.schema.shape.modules.shape["skill-track"]),
        defaultValues: settings.modules["skill-track"],
    });

    const mutation = useOrganizationSettingsMutation({
        organizationId,
        errorMessage: "Failed to update Skill Track module settings",
        onSaved: (updated) => form.reset(updated.modules["skill-track"]),
    });

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId,
            settings: { ...settings, modules: { ...settings.modules, "skill-track": formData } },
        });
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Skill Track Module</CardTitle>
                <CardDescription>
                    The Skill Track module provides functionality for managing skills and
                    competencies within your organization.
                </CardDescription>
                <CardAction>
                    <Controller
                        control={form.control}
                        name="enabled"
                        render={({ field }) => (
                            <Switch
                                id="skill-track-module-enabled"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </CardAction>
            </CardHeader>
            <CardContent>
                <form id="skill-track-module-settings-form" onSubmit={handleSubmit}>
                    <FieldSet className="w-xl">
                        <FieldLegend>Skill Check Result Options</FieldLegend>
                        <FieldDescription>
                            Configure which skill check result options are available for use in your
                            organization. You can enable or disable each option and customize its
                            label.
                        </FieldDescription>
                        <FieldGroup>
                            {SKILL_TRACK_CONFIGURABLE_RESULT_VALUES.map((value) => (
                                <SkillCheckResult_SettingsRow
                                    key={value}
                                    value={value}
                                    control={form.control}
                                />
                            ))}
                        </FieldGroup>
                    </FieldSet>
                </form>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
                {form.formState.isDirty && (
                    <Button variant="ghost" type="button" onClick={() => form.reset()}>
                        Reset
                    </Button>
                )}
                <MutationButton
                    form="skill-track-module-settings-form"
                    status={mutation.status}
                    text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    disabled={mutation.status !== "idle"}
                />
            </CardFooter>
        </Card>
    );
}

function SkillCheckResult_SettingsRow({
    value,
    control,
}: {
    value: SkillCheckResultValue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamically focused per result value
    control: Control<any>;
}) {
    const enabled = useWatch({ control, name: `results.${value}.enabled` });

    return (
        <div className="flex gap-4">
            <Controller
                control={control}
                name={`results.${value}.enabled`}
                render={({ field }) => (
                    <Switch
                        id={`skill-check-result-${value}-enabled`}
                        checked={field.value}
                        onCheckedChange={field.onChange}
                    />
                )}
            />
            <Field>
                <FieldLabel htmlFor={`skill-check-result-${value}-label`}>{value}</FieldLabel>

                <Controller
                    control={control}
                    name={`results.${value}.label`}
                    render={({ field, fieldState }) => (
                        <FieldContent>
                            <Input
                                id={`skill-check-result-${value}-label`}
                                className="min-w-1/2"
                                aria-invalid={fieldState.invalid}
                                disabled={!enabled}
                                value={field.value}
                                onChange={field.onChange}
                            />
                            {fieldState.error && <FieldError errors={[fieldState.error]} />}
                        </FieldContent>
                    )}
                />
            </Field>
        </div>
    );
}
