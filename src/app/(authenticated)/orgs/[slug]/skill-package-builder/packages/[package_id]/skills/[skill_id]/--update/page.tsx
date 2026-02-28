/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/--update
 */
"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Show } from "@/components/show";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useSkill } from "@/hooks/use-skill";
import { ModifiableSkill, Skill } from "@/lib/schemas/skill";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export default function SkillPackageBuilder_UpdateSkill_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/--update`>,
) {
    const { slug, package_id, skill_id } = use(props.params);

    const skill = useSkill({
        skillPackageId: package_id,
        skillId: skill_id,
    });

    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(Skill.modifiableSchema),
        defaultValues: skill,
    });

    const mutation = useMutation(
        trpc.skills.updateSkill.mutationOptions({
            onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause.message as keyof ModifiableSkill,
                        { message: error.message },
                    );
                } else {
                    toast.error(`Failed to update skill: ${error.message}`);
                    console.error("Failed to update skill:", error);
                }
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.skills.listSkills.queryFilter({
                        organizationId: organization.id,
                        skillPackageId: skill.skillPackageId,
                    }),
                );

                router.push(
                    Paths.org(organization.slug)
                        .skillPackageBuilder.skillPackage(skill.skillPackageId)
                        .skill(skill.id).href,
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            skillId: skill.id,
            organizationId: organization.id,
            update: formData,
        });
    });

    const packagePath = Paths.org(slug).skillPackageBuilder.skillPackage(
        skill.skillPackage,
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageBuilder.index,
                    packagePath.index,
                    "Skills",
                    packagePath.skill(skill),
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={packagePath.skill(skill)}
                            tooltip={`Back to skill: ${skill.name}`}
                        />
                        <Hermes.Title>{skill.name}</Hermes.Title>
                    </Hermes.Header>

                    <Card>
                        <CardHeader>
                            <CardTitle>Update Skill</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form
                                id="update-skill-form"
                                onSubmit={handleSubmit}
                            >
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldLabel>Skill ID</FieldLabel>
                                        <FieldValue
                                            value={skill.id}
                                            format="id"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Package</FieldLabel>
                                        <FieldValue
                                            value={skill.skillPackage.name}
                                        />
                                    </Field>

                                    <Field orientation="responsive">
                                        <FieldLabel>Group</FieldLabel>
                                        <FieldValue
                                            value={skill.skillGroup.name}
                                        />
                                    </Field>

                                    <Controller
                                        name="name"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                data-invalid={
                                                    fieldState.invalid
                                                }
                                                orientation="responsive"
                                            >
                                                <FieldLabel htmlFor="skill-name">
                                                    Name
                                                </FieldLabel>
                                                <Input
                                                    id="skill-name"
                                                    autoFocus
                                                    placeholder="Skill Name"
                                                    aria-invalid={
                                                        fieldState.invalid
                                                    }
                                                    {...field}
                                                />
                                                {fieldState.error && (
                                                    <FieldError
                                                        errors={[
                                                            fieldState.error,
                                                        ]}
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
                                                data-invalid={
                                                    fieldState.invalid
                                                }
                                                orientation="responsive"
                                            >
                                                <FieldLabel htmlFor="skill-description">
                                                    Description
                                                </FieldLabel>
                                                <Textarea
                                                    id="skill-description"
                                                    aria-invalid={
                                                        fieldState.invalid
                                                    }
                                                    {...field}
                                                />
                                                {fieldState.error && (
                                                    <FieldError
                                                        errors={[
                                                            fieldState.error,
                                                        ]}
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
                                                data-invalid={
                                                    fieldState.invalid
                                                }
                                            >
                                                <FieldContent>
                                                    <FieldLabel htmlFor="default-required">
                                                        Required
                                                    </FieldLabel>
                                                    <FieldDescription>
                                                        Whether this skill is
                                                        required by default.
                                                    </FieldDescription>
                                                </FieldContent>
                                                <Select
                                                    value={
                                                        field.value
                                                            ? "true"
                                                            : "false"
                                                    }
                                                    onValueChange={(value) =>
                                                        field.onChange(
                                                            value === "true",
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger
                                                        id="default-required"
                                                        aria-invalid={
                                                            fieldState.invalid
                                                        }
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
                                                        errors={[
                                                            fieldState.error,
                                                        ]}
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
                                                data-invalid={
                                                    fieldState.invalid
                                                }
                                                orientation="responsive"
                                            >
                                                <FieldContent>
                                                    <FieldLabel htmlFor="frequency">
                                                        Revalidation Frequency
                                                    </FieldLabel>
                                                    <FieldDescription>
                                                        How often this skill
                                                        should be revalidated.
                                                    </FieldDescription>
                                                </FieldContent>

                                                <InputGroup
                                                    aria-invalid={
                                                        fieldState.invalid
                                                    }
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
                                                                    ev
                                                                        .currentTarget
                                                                        .value,
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
                                                        errors={[
                                                            fieldState.error,
                                                        ]}
                                                    />
                                                )}
                                            </Field>
                                        )}
                                    />
                                    <Field orientation="horizontal">
                                        <MutationButton
                                            type="submit"
                                            form="update-skill-form"
                                            status={mutation.status}
                                            text={{
                                                idle: "Update",
                                                pending: "Updating",
                                                success: "Updated",
                                            }}
                                        />
                                        <Show when={mutation.isIdle}>
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
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
