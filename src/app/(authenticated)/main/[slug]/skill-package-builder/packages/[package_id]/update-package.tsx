/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";
import { ModifiableSkillPackage, SkillPackage } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_UpdatePackage_Dialog({
    skillPackage,
}: {
    skillPackage: SkillPackage;
}) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const [dialogOpen, setDialogOpen] = useState(false);

    const form = useForm({
        resolver: zodResolver(SkillPackage.modifiableSchema),
        defaultValues: skillPackage,
    });

    const mutation = useMutation(
        trpc.skillPackageBuilder.updatePackage.mutationOptions({
            onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(error.shape.cause.message as keyof ModifiableSkillPackage, {
                        message: error.message,
                    });
                } else {
                    toast.error(`Failed to update skill package: ${error.message}`);
                    console.error("Failed to update skill package:", error);
                }
            },
            async onSuccess() {
                toast.success("Skill package updated");

                handleOpenChange(false);

                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listPackages.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        if (!open) {
            form.reset();
            mutation.reset();
        }
        setDialogOpen(open);
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update skill package</DialogTitle>
                    <DialogDescription>Update the details of this skill package.</DialogDescription>
                </DialogHeader>
                <form
                    id="update-skill-package-form"
                    onSubmit={form.handleSubmit((formData) =>
                        mutation.mutate({
                            skillPackageId: skillPackage.id,
                            organizationId: organization.id,
                            update: formData,
                        }),
                    )}
                >
                    <FieldGroup>
                        <Field orientation="responsive">
                            <FieldLabel>Package ID</FieldLabel>
                            <FieldValue value={skillPackage.id} format="id" />
                        </Field>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid} orientation="responsive">
                                    <FieldLabel htmlFor="package-name">Name</FieldLabel>
                                    <Input
                                        id="package-name"
                                        autoFocus
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="description"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid} orientation="responsive">
                                    <FieldLabel htmlFor="package-description">
                                        Description
                                    </FieldLabel>
                                    <Textarea
                                        id="package-description"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Field orientation="horizontal">
                            <MutationButton
                                type="submit"
                                form="update-skill-package-form"
                                status={mutation.status}
                                text={{
                                    idle: "Update",
                                    pending: "Updating...",
                                    success: "Updated",
                                }}
                            />
                            <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                        </Field>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}
