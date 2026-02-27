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
    ModifiableSkillGroup,
    SkillGroup,
    SkillGroupId,
} from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

interface SkillPackageBuilder_Group_FormProps {
    formMode: "Create" | "Update";
    id: SkillGroupId;
    defaultValues: ModifiableSkillGroup;
    skillPackage: SkillPackage;
}

export function SkillPackageBuilder_Group_Form(
    props: SkillPackageBuilder_Group_FormProps,
) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(SkillGroup.modifiableSchema),
        defaultValues: props.defaultValues,
    });

    const createMutation = useMutation(
        trpc.skills.createGroup.mutationOptions({
            onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause.message as keyof ModifiableSkillGroup,
                        { message: error.message },
                    );
                } else {
                    toast.error(
                        `Failed to create skill group: ${error.message}`,
                    );
                    console.error("Failed to create skill group:", error);
                }
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skills.listGroups.queryFilter({
                        organizationId: organization.id,
                        skillPackageId: props.skillPackage.id,
                    }),
                );

                router.push(
                    Paths.org(organization.slug)
                        .skillPackageBuilder.skillPackage(props.skillPackage.id)
                        .group(props.id).index.href,
                );
            },
        }),
    );

    const updateMutation = useMutation(
        trpc.skills.updateGroup.mutationOptions({
            onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause.message as keyof ModifiableSkillGroup,
                        { message: error.message },
                    );
                } else {
                    toast.error(
                        `Failed to update skill group: ${error.message}`,
                    );
                    console.error("Failed to update skill group:", error);
                }
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skills.listGroups.queryFilter({
                        organizationId: organization.id,
                        skillPackageId: props.skillPackage.id,
                    }),
                );

                router.push(
                    Paths.org(organization.slug)
                        .skillPackageBuilder.skillPackage(props.skillPackage.id)
                        .group(props.id).index.href,
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData: ModifiableSkillGroup) => {
        if (props.formMode === "Create") {
            createMutation.mutate({
                skillGroupId: props.id,
                skillPackageId: props.skillPackage.id,
                organizationId: organization.id,
                create: formData,
            });
        } else {
            updateMutation.mutate({
                skillGroupId: props.id,
                organizationId: organization.id,
                update: formData,
            });
        }
    });

    return (
        <Card>
            <CardHeader>
                <Watch
                    control={form.control}
                    names={["name"]}
                    render={([name]) => (
                        <CardTitle>{name || "New Skill Group"}</CardTitle>
                    )}
                />
                <CardDescription>Skill Group</CardDescription>
            </CardHeader>
            <CardContent>
                <form id="skill-group-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Field orientation="responsive">
                            <FieldLabel>Group ID</FieldLabel>
                            <FieldValue value={props.id} format="id" />
                        </Field>
                        <Field orientation="responsive">
                            <FieldLabel>Package</FieldLabel>
                            <FieldValue value={props.skillPackage.name} />
                        </Field>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    orientation="responsive"
                                >
                                    <FieldLabel htmlFor="group-name">
                                        Name
                                    </FieldLabel>

                                    <Input
                                        id="group-name"
                                        autoFocus
                                        placeholder="New Skill Group"
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
                                    <FieldLabel htmlFor="group-description">
                                        Description
                                    </FieldLabel>

                                    <Textarea
                                        id="group-description"
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
                                        form="skill-group-form"
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
                                        form="skill-group-form"
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
