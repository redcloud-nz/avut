/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { CreateNewIcon } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { skillPackageBuilderInvalidations } from "@/client/skill-package-builder-invalidations";
import { useOrganization } from "@/hooks/use-organization";
import { ModifiableSkillPackage, SkillPackage, SkillPackageId } from "@/lib/schemas/skill-package";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_CreatePackage_Dialog() {
    const organization = useOrganization();
    const router = useRouter();

    const [dialogOpen, setDialogOpen] = useState(false);

    const form = useForm({
        resolver: zodResolver(SkillPackage.modifiableSchema),
        defaultValues: {
            name: "",
            description: "",
            tags: [],
            properties: {},
        },
    });

    const mutation = useMutation(
        trpc.skillPackageBuilder.createPackage.mutationOptions({
            meta: { invalidates: skillPackageBuilderInvalidations.createPackage },
            onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(error.shape.cause.message as keyof ModifiableSkillPackage, {
                        message: error.message,
                    });
                } else {
                    toast.error(`Failed to create skill package: ${error.message}`);
                    console.error("Failed to create skill package:", error);
                }
            },
            onSuccess({ created }) {
                handleOpenChange(false);

                router.push(
                    route("/orgs/[slug]/skill-package-builder/packages/[package_id]", {
                        slug: organization.slug,
                        package_id: created.id,
                    }),
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) => {
            mutation.mutate({
                organizationId: organization.id,
                skillPackageId: SkillPackageId.create(),
                create: formData,
            });
        },
        (errors) => {
            console.error("Form validation errors:", errors);
        },
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
                <Button variant="outline">
                    <CreateNewIcon /> <span className="hidden md:inline">New</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Package</DialogTitle>
                    <DialogDescription>Create a new skill package.</DialogDescription>
                </DialogHeader>
                <form id="create-skill-package-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
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
                                <Field data-invalid={fieldState.invalid}>
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
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="create-skill-package-form"
                        status={mutation.status}
                        text={{
                            idle: "Create",
                            pending: "Creating",
                            success: "Created",
                        }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
