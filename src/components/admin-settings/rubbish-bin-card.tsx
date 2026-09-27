/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Controller, useForm, useWatch } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { useOrganizationSettingsMutation } from "@/components/admin-settings/use-organization-settings-mutation";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from "@/components/ui/input-group";
import { OrganizationId } from "@/lib/schemas/organization";
import {
    OrganizationSettings,
    RUBBISH_BIN_MAX_RETENTION_DAYS,
    RUBBISH_BIN_POLICY_RETENTION_DAYS,
} from "@/lib/schemas/organization-settings";

/**
 * How long a deleted record waits in the Rubbish bin before the daily purge removes it (#298).
 * One window for every kind of record the organisation owns.
 */
export function RubbishBin_SettingsCard({
    organizationId,
    settings,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
}) {
    const form = useForm({
        resolver: zodResolver(OrganizationSettings.schema.shape.rubbishBin),
        defaultValues: settings.rubbishBin,
    });
    const retentionDays = useWatch({ control: form.control, name: "retentionDays" });

    const mutation = useOrganizationSettingsMutation({
        errorMessage: "Failed to update Rubbish bin settings",
        onSaved: (updated) => form.reset(updated.rubbishBin),
    });

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({ organizationId, update: { slice: "rubbishBin", patch: formData } });
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Rubbish Bin</CardTitle>
            </CardHeader>
            <CardContent>
                <form id="rubbish-bin-settings-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            control={form.control}
                            name="retentionDays"
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldContent>
                                        <FieldLabel htmlFor="rubbish-bin-retention-days">
                                            Keep deleted records for
                                        </FieldLabel>
                                        <FieldDescription>
                                            Deleted records can be recovered from the Rubbish bin
                                            until this many days have passed, then they are
                                            permanently deleted. 1 to{" "}
                                            {RUBBISH_BIN_MAX_RETENTION_DAYS} days.
                                        </FieldDescription>
                                    </FieldContent>
                                    <InputGroup aria-invalid={fieldState.invalid}>
                                        <InputGroupInput
                                            id="rubbish-bin-retention-days"
                                            type="number"
                                            min={1}
                                            max={RUBBISH_BIN_MAX_RETENTION_DAYS}
                                            value={field.value}
                                            onChange={(ev) =>
                                                field.onChange(parseInt(ev.currentTarget.value))
                                            }
                                        />
                                        <InputGroupAddon align="inline-end">
                                            <InputGroupText>days</InputGroupText>
                                        </InputGroupAddon>
                                    </InputGroup>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                    {(retentionDays ?? 0) > RUBBISH_BIN_POLICY_RETENTION_DAYS && (
                                        <FieldDescription className="text-amber-900 dark:text-amber-100">
                                            More than {RUBBISH_BIN_POLICY_RETENTION_DAYS} days keeps
                                            personal information longer than the AVUT privacy policy
                                            promises. Check with whoever is responsible for your
                                            organisation&rsquo;s privacy obligations first.
                                        </FieldDescription>
                                    )}
                                </Field>
                            )}
                        />
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
                    form="rubbish-bin-settings-form"
                    status={mutation.status}
                    text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    disabled={mutation.status !== "idle"}
                />
            </CardFooter>
        </Card>
    );
}
