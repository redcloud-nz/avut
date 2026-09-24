/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Controller, useForm } from "react-hook-form";

import { zodResolver } from "@hookform/resolvers/zod";

import { useOrganizationSettingsMutation } from "@/components/admin-settings/use-organization-settings-mutation";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

/**
 * When AVUT may attach a person record to a user account on its own.
 *
 * Both switches are off by default and neither ever grants membership — they only fill in the
 * link on a membership that already exists. Inviting someone from their person record works
 * regardless of these settings.
 */
export function Personnel_SettingsCard({
    organizationId,
    settings,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
}) {
    const form = useForm({
        resolver: zodResolver(OrganizationSettings.schema.shape.personnel),
        defaultValues: settings.personnel,
    });

    const mutation = useOrganizationSettingsMutation({
        errorMessage: "Failed to update personnel settings",
        onSaved: (updated) => form.reset(updated.personnel),
    });

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({ organizationId, settings: { ...settings, personnel: formData } });
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Personnel</CardTitle>
            </CardHeader>
            <CardContent>
                <form id="personnel-settings-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            control={form.control}
                            name="autoLinkOnInviteAccept"
                            render={({ field }) => (
                                <Field orientation="horizontal">
                                    <Switch
                                        id="personnel-auto-link-on-invite-accept"
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                    <FieldContent>
                                        <FieldLabel htmlFor="personnel-auto-link-on-invite-accept">
                                            Link on invitation accept
                                        </FieldLabel>
                                        <FieldDescription>
                                            When someone accepts an invitation, attach them to the
                                            person record with the same email address, if there is
                                            one.
                                        </FieldDescription>
                                    </FieldContent>
                                </Field>
                            )}
                        />
                        <Controller
                            control={form.control}
                            name="autoLinkOnPersonCreate"
                            render={({ field }) => (
                                <Field orientation="horizontal">
                                    <Switch
                                        id="personnel-auto-link-on-person-create"
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                    <FieldContent>
                                        <FieldLabel htmlFor="personnel-auto-link-on-person-create">
                                            Link when a person is added
                                        </FieldLabel>
                                        <FieldDescription>
                                            When a person is added, attach them to the account of an
                                            existing member with the same email address. Someone who
                                            is not already a member is never added to the
                                            organisation — invite them from their person record
                                            instead.
                                        </FieldDescription>
                                    </FieldContent>
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
                    form="personnel-settings-form"
                    status={mutation.status}
                    text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    disabled={mutation.status !== "idle"}
                />
            </CardFooter>
        </Card>
    );
}
