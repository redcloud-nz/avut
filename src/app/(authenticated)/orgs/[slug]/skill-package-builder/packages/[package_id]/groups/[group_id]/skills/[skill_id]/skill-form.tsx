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
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Input } from "@/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
    InputGroupText,
} from "@/components/ui/input-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";
import { ModifiableSkill, Skill, SkillId } from "@/lib/schemas/skill";
import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";
import { Show } from "@/components/show";

interface SkillPackageBuilder_Skill_FormProps {
    formMode: "Create" | "Update";
    skillId: SkillId;
    defaultValues: ModifiableSkill;
    skillPackage: SkillPackage;
    skillGroup: SkillGroup;
}

export function SkillPackageBuilder_Skill_Form({
    formMode,
    skillId,
    defaultValues,
    skillPackage,
    skillGroup,
}: SkillPackageBuilder_Skill_FormProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(Skill.modifiableSchema),
        defaultValues: defaultValues,
    });

    const createMutation = useMutation(
        trpc.skills.createSkill.mutationOptions({
            onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause.message as keyof ModifiableSkill,
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
                    trpc.skills.listSkills.queryFilter({
                        organizationId: organization.id,
                        skillPackageId: skillPackage.id,
                    }),
                );

                router.push(
                    Paths.org(organization.slug)
                        .skillPackageBuilder.skillPackage(skillPackage.id)
                        .group(skillGroup.id).index.href,
                );
            },
        }),
    );

    const updateMutation = useMutation(
        trpc.skills.updateSkill.mutationOptions({
            onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause.message as keyof ModifiableSkill,
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
                    trpc.skills.listSkills.queryFilter({
                        organizationId: organization.id,
                        skillPackageId: skillPackage.id,
                    }),
                );

                router.push(
                    Paths.org(organization.slug)
                        .skillPackageBuilder.skillPackage(skillPackage.id)
                        .group(skillGroup.id).index.href,
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData: ModifiableSkill) => {
        if (formMode === "Create") {
            createMutation.mutate({
                organizationId: organization.id,
                skillId,
                skillGroupId: skillGroup.id,
                skillPackageId: skillPackage.id,
                create: formData,
            });
        } else {
            updateMutation.mutate({
                organizationId: organization.id,
                skillId,
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
                        <CardTitle>{name || "New Skill"}</CardTitle>
                    )}
                />
                <CardDescription>Skill</CardDescription>
            </CardHeader>
            <CardContent>
                <form id="skill-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Field orientation="responsive">
                            <FieldLabel>Skill ID</FieldLabel>
                            <FieldValue value={skillId} format="id" />
                        </Field>
                        <Field orientation="responsive">
                            <FieldLabel>Package</FieldLabel>
                            <FieldValue value={skillPackage.name} />
                        </Field>

                        <Field orientation="responsive">
                            <FieldLabel>Group</FieldLabel>
                            <FieldValue value={skillGroup.name} />
                        </Field>

                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    orientation="responsive"
                                >
                                    <FieldLabel htmlFor="skill-name">
                                        Name
                                    </FieldLabel>
                                    <Input
                                        id="skill-name"
                                        autoFocus
                                        placeholder="Skill Name"
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
                                    <FieldLabel htmlFor="skill-description">
                                        Description
                                    </FieldLabel>
                                    <Textarea
                                        id="skill-description"
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
                            name="defaultRequired"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field
                                    orientation="responsive"
                                    data-invalid={fieldState.invalid}
                                >
                                    <FieldContent>
                                        <FieldLabel htmlFor="default-required">
                                            Required
                                        </FieldLabel>
                                        <FieldDescription>
                                            Whether this skill is required by
                                            default.
                                        </FieldDescription>
                                    </FieldContent>
                                    <Select
                                        value={field.value ? "true" : "false"}
                                        onValueChange={(value) =>
                                            field.onChange(value === "true")
                                        }
                                    >
                                        <SelectTrigger
                                            id="default-required"
                                            aria-invalid={fieldState.invalid}
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="true">
                                                Yes
                                            </SelectItem>
                                            <SelectItem value="false">
                                                No
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {fieldState.error && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="frequency"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    orientation="responsive"
                                >
                                    <FieldContent>
                                        <FieldLabel htmlFor="frequency">
                                            Revalidation Frequency
                                        </FieldLabel>
                                        <FieldDescription>
                                            How often this skill should be
                                            revalidated.
                                        </FieldDescription>
                                    </FieldContent>

                                    <InputGroup
                                        aria-invalid={fieldState.invalid}
                                    >
                                        <InputGroupInput
                                            id="frequency"
                                            type="number"
                                            min={1}
                                            max={48}
                                            value={field.value}
                                            onChange={(ev) =>
                                                field.onChange(
                                                    parseInt(
                                                        ev.currentTarget.value,
                                                    ),
                                                )
                                            }
                                        />
                                        <InputGroupAddon align="inline-end">
                                            <InputGroupText>
                                                months
                                            </InputGroupText>
                                        </InputGroupAddon>
                                    </InputGroup>
                                    {fieldState.error && (
                                        <FieldError
                                            errors={[fieldState.error]}
                                        />
                                    )}
                                </Field>
                            )}
                        />
                        <Field orientation="horizontal">
                            {match(formMode)
                                .with("Create", () => (
                                    <MutationButton
                                        type="submit"
                                        form="skill-form"
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
                                        form="skill-form"
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
