/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm, Watch } from "react-hook-form";
import { toast } from "sonner";
import { match } from "ts-pattern";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Show } from "@/components/show";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";
import {
    ModifiableSkillPackage,
    SkillPackage,
    SkillPackageId,
} from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

interface SkillPackageBuilder_Package_FormProps {
    formMode: "Create" | "Update";
    id: SkillPackageId;
    defaultValues: ModifiableSkillPackage;
}

/**
 * Form component for creating and updating skill packages. Renders a form with fields for name and description.
 * @param props - The props for the form component, including form mode, default values.
 */
export function SkillPackageBuilder_Package_Form(
    props: SkillPackageBuilder_Package_FormProps,
) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(SkillPackage.modifiableSchema),
        defaultValues: props.defaultValues,
    });

    const createMutation = useMutation(
        trpc.skills.createPackage.mutationOptions({
            onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause
                            .message as keyof ModifiableSkillPackage,
                        { message: error.message },
                    );
                } else {
                    toast.error(
                        `Failed to create skill package: ${error.message}`,
                    );
                    console.error("Failed to create skill package:", error);
                }
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skills.listPackages.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                router.push(
                    Paths.org(
                        organization.slug,
                    ).skillPackageBuilder.skillPackage(props.id).index.href,
                );
            },
        }),
    );

    const updateMutation = useMutation(
        trpc.skills.updatePackage.mutationOptions({
            onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause
                            .message as keyof ModifiableSkillPackage,
                        { message: error.message },
                    );
                } else {
                    toast.error(
                        `Failed to update skill package: ${error.message}`,
                    );
                    console.error("Failed to update skill package:", error);
                }
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skills.listPackages.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                router.push(
                    Paths.org(
                        organization.slug,
                    ).skillPackageBuilder.skillPackage(props.id).index.href,
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData: ModifiableSkillPackage) => {
            if (props.formMode === "Create") {
                createMutation.mutate({
                    skillPackageId: props.id,
                    organizationId: organization.id,
                    create: formData,
                });
            } else {
                updateMutation.mutate({
                    skillPackageId: props.id,
                    organizationId: organization.id,
                    update: formData,
                });
            }
        },
    );

    return (
        <Card>
            <CardHeader>
                <Watch
                    control={form.control}
                    names={["name"]}
                    render={([name]) => (
                        <CardTitle>{name || "New Skill Package"}</CardTitle>
                    )}
                />
                <CardDescription>Skill Package</CardDescription>
            </CardHeader>
            <CardContent>
                <form id="skill-package-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Field orientation="responsive">
                            <FieldLabel>Package ID</FieldLabel>
                            <FieldValue value={props.id} format="id" />
                        </Field>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    orientation="responsive"
                                >
                                    <FieldLabel htmlFor="package-name">
                                        Name
                                    </FieldLabel>
                                    <Input
                                        id="package-name"
                                        autoFocus
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="description"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    orientation="responsive"
                                >
                                    <FieldLabel htmlFor="package-description">
                                        Description
                                    </FieldLabel>
                                    <Textarea
                                        id="package-description"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Field orientation="horizontal">
                            {match(props.formMode)
                                .with("Create", () => (
                                    <MutationButton
                                        type="submit"
                                        form="skill-package-form"
                                        status={createMutation.status}
                                        text={{
                                            idle: "Create",
                                            pending: "Creating",
                                            success: "Created",
                                        }}
                                    />
                                ))
                                .with("Update", () => (
                                    <MutationButton
                                        type="submit"
                                        form="skill-package-form"
                                        status={updateMutation.status}
                                        text={{
                                            idle: "Update",
                                            pending: "Updating",
                                            success: "Updated",
                                        }}
                                    />
                                ))
                                .exhaustive()}
                            <Show
                                when={
                                    !(
                                        createMutation.isPending ||
                                        updateMutation.isPending
                                    )
                                }
                            >
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        form.reset();
                                        router.back();
                                    }}
                                >
                                    Cancel
                                </Button>
                            </Show>
                        </Field>
                    </FieldGroup>
                </form>
            </CardContent>
        </Card>
    );
}
