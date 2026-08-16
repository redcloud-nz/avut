/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button, MutationButton } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { trpc } from "@/trpc/client";

export function EmailIntegration_SettingsCard({
    organizationId,
    settings,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
}) {
    const queryClient = useQueryClient();

    const form = useForm({
        resolver: zodResolver(OrganizationSettings.schema.shape.integrations.shape.email),
        defaultValues: settings.integrations.email,
    });

    const mutation = useMutation(
        trpc.settings.updateOrganizationSettings.mutationOptions({
            onError(error) {
                toast.error(`Failed to update email integration settings: ${error.message}`);
                mutation.reset();
            },
            async onSuccess(updated) {
                await queryClient.invalidateQueries(
                    trpc.settings.getOrganizationSettings.queryFilter({ organizationId }),
                );
                form.reset(updated.integrations.email);
                setTimeout(() => mutation.reset(), 1500);
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId,
            settings: { ...settings, integrations: { ...settings.integrations, email: formData } },
        });
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Email Integration</CardTitle>
                <CardAction>
                    <Controller
                        control={form.control}
                        name="enabled"
                        render={({ field }) => (
                            <Switch
                                id="email-integration-enabled"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </CardAction>
            </CardHeader>
            <CardContent>
                <form id="email-integration-settings-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        {/* Currently no additional settings for email integration, but we could add some in the future */}
                        <div className="text-sm text-muted-foreground">
                            No additional settings available.
                        </div>
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
                    form="email-integration-settings-form"
                    status={mutation.status}
                    text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    disabled={mutation.status !== "idle"}
                />
            </CardFooter>
        </Card>
    );
}
