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

import { ObjectIcons } from "@/components/icons";
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
import { ObjectName } from "@/components/ui/typography";

import { skillPackageBuilderInvalidations } from "@/client/skill-package-builder-invalidations";
import { useOrganization } from "@/hooks/use-organization";
import { ModifiableSkillGroup, SkillGroup, SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_CreateGroup_Dialog({
    skillPackage,
}: {
    skillPackage: SkillPackage;
}) {
    const organization = useOrganization();
    const router = useRouter();

    const [dialogOpen, setDialogOpen] = useState(false);

    const form = useForm({
        resolver: zodResolver(SkillGroup.modifiableSchema),
        defaultValues: {
            name: "",
            description: "",
            tags: [],
            properties: {},
        },
    });

    const mutation = useMutation(
        trpc.skillPackageBuilder.createGroup.mutationOptions({
            meta: { invalidates: skillPackageBuilderInvalidations.createGroup },
            onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(error.shape.cause.message as keyof ModifiableSkillGroup, {
                        message: error.message,
                    });
                } else {
                    toast.error(`Failed to create skill group: ${error.message}`);
                    console.error("Failed to create skill group:", error);
                }
            },
            onSuccess({ created }) {
                toast.success(
                    <>
                        Skill Group <ObjectName>{created.name}</ObjectName> created successfully!
                    </>,
                );

                handleOpenChange(false);

                router.push(
                    route(
                        "/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]",
                        {
                            slug: organization.slug,
                            package_id: skillPackage.id,
                            group_id: created.id,
                        },
                    ),
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) => {
            mutation.mutate({
                organizationId: organization.id,
                skillPackageId: skillPackage.id,
                skillGroupId: SkillGroupId.create(),
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
                <Button variant="ghost" size="icon">
                    <ObjectIcons.Create />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Group</DialogTitle>
                    <DialogDescription>
                        Create a new skill group within the package {skillPackage.name}.
                    </DialogDescription>
                </DialogHeader>
                <form id="create-skill-group-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="group-name">Name</FieldLabel>
                                    <Input
                                        id="group-name"
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
                                    <FieldLabel htmlFor="group-description">Description</FieldLabel>
                                    <Textarea
                                        id="group-description"
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
                        form="create-skill-group-form"
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
