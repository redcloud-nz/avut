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

export function D4HViewsModule_SettingsCard({
    organizationId,
    settings,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
}) {
    const queryClient = useQueryClient();

    const form = useForm({
        resolver: zodResolver(OrganizationSettings.schema.shape.modules.shape["d4h-views"]),
        defaultValues: settings.modules["d4h-views"],
    });

    const mutation = useMutation(
        trpc.settings.updateOrganizationSettings.mutationOptions({
            onError(error) {
                toast.error(`Failed to update D4H Views module settings: ${error.message}`);
                mutation.reset();
            },
            async onSuccess(updated) {
                await queryClient.invalidateQueries(
                    trpc.settings.getOrganizationSettings.queryFilter({ organizationId }),
                );
                form.reset(updated.modules["d4h-views"]);
                setTimeout(() => mutation.reset(), 1500);
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId,
            settings: {
                ...settings,
                modules: { ...settings.modules, "d4h-views": formData },
            },
        });
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>D4H Views Module</CardTitle>
                <CardAction>
                    <Controller
                        control={form.control}
                        name="enabled"
                        render={({ field }) => (
                            <Switch
                                id="d4h-views-module-enabled"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </CardAction>
            </CardHeader>
            <CardContent>
                <form id="d4h-views-module-settings-form" onSubmit={handleSubmit}>
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
                    form="d4h-views-module-settings-form"
                    status={mutation.status}
                    text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    disabled={mutation.status !== "idle"}
                />
            </CardFooter>
        </Card>
    );
}
