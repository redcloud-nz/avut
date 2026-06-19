/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Controller, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";
import { ModifiableSkillPackage, SkillPackage, SkillPackageId } from "@/lib/schemas/skill-package";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_CreatePackage_Dialog(props: DialogProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

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
            async onSuccess({ created }) {
                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listPackages.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                props.onOpenChange?.(false);
                form.reset();
                router.push(
                    route("/main/[slug]/skill-package-builder/packages/[package_id]", {
                        slug: organization.slug,
                        package_id: created.id,
                    }),
                );

                mutation.reset();
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId: organization.id,
            skillPackageId: SkillPackageId.create(),
            create: formData,
        });
    });

    return (
        <Dialog {...props}>
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
                    <DialogCloseButton variant="outline" onClick={() => form.reset()}>
                        Cancel
                    </DialogCloseButton>
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
