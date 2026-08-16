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
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { FieldGroup } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilderModule_SettingsCard({
    organizationId,
    settings,
}: {
    organizationId: OrganizationId;
    settings: OrganizationSettings;
}) {
    const queryClient = useQueryClient();

    const form = useForm({
        resolver: zodResolver(
            OrganizationSettings.schema.shape.modules.shape["skill-package-builder"],
        ),
        defaultValues: settings.modules["skill-package-builder"],
    });

    const mutation = useMutation(
        trpc.settings.updateOrganizationSettings.mutationOptions({
            onError(error) {
                toast.error(
                    `Failed to update Skill Package Builder module settings: ${error.message}`,
                );
                mutation.reset();
            },
            async onSuccess(updated) {
                await queryClient.invalidateQueries(
                    trpc.settings.getOrganizationSettings.queryFilter({ organizationId }),
                );
                form.reset(updated.modules["skill-package-builder"]);
                setTimeout(() => mutation.reset(), 1500);
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId,
            settings: {
                ...settings,
                modules: { ...settings.modules, "skill-package-builder": formData },
            },
        });
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Skill Package Builder Module</CardTitle>
                <CardDescription>
                    The Skill Package Builder module allows you to create and manage skill packages
                    that can then be used by the Skills Module.
                </CardDescription>
                <CardAction>
                    <Controller
                        control={form.control}
                        name="enabled"
                        render={({ field }) => (
                            <Switch
                                id="skill-package-builder-module-enabled"
                                checked={field.value}
                                onCheckedChange={field.onChange}
                            />
                        )}
                    />
                </CardAction>
            </CardHeader>
            <CardContent>
                <form id="skill-package-builder-module-settings-form" onSubmit={handleSubmit}>
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
                    form="skill-package-builder-module-settings-form"
                    status={mutation.status}
                    text={{ idle: "Save", pending: "Saving...", success: "Saved!" }}
                    disabled={mutation.status !== "idle"}
                />
            </CardFooter>
        </Card>
    );
}
