/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/--update
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
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";
import { useSkillGroup } from "@/hooks/use-skill-group";
import { ModifiableSkillGroup, SkillGroup } from "@/lib/schemas/skill-group";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

/**
 * Page to update an existing skill group. Fetches the skill group data and renders the update form.
 */
export default function SkillPackageBuilder_UpdateGroup_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/--update`>,
) {
    const { slug, package_id, group_id } = use(props.params);

    const skillGroup = useSkillGroup({
        skillPackageId: package_id,
        skillGroupId: group_id,
    });

    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(SkillGroup.modifiableSchema),
        defaultValues: skillGroup,
    });

    const mutation = useMutation(
        trpc.skillPackageBuilder.updateGroup.mutationOptions({
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
                    trpc.skillPackageBuilder.listGroups.queryFilter({
                        organizationId: organization.id,
                        skillPackageId: skillGroup.skillPackageId,
                    }),
                );

                router.push(
                    Paths.org(organization.slug)
                        .skillPackageBuilder.skillPackage(
                            skillGroup.skillPackageId,
                        )
                        .group(skillGroup.id).href,
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId: organization.id,
            skillGroupId: skillGroup.id,
            update: formData,
        });
    });

    const packagePath = Paths.org(slug).skillPackageBuilder.skillPackage(
        skillGroup.skillPackage,
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageBuilder.index,
                    packagePath.index,
                    "Groups",
                    packagePath.group(skillGroup),
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={packagePath.group(skillGroup)}
                            tooltip={`Back to group: ${skillGroup.skillPackage.name} / ${skillGroup.name}`}
                        />
                        <Hermes.Title>{skillGroup.name}</Hermes.Title>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Update Group</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form id="skill-group-form" onSubmit={handleSubmit}>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldLabel>Group ID</FieldLabel>
                                        <FieldValue
                                            value={skillGroup.id}
                                            format="id"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Package</FieldLabel>
                                        <FieldValue
                                            value={skillGroup.skillPackage.name}
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
                                                <FieldLabel htmlFor="group-name">
                                                    Name
                                                </FieldLabel>

                                                <Input
                                                    id="group-name"
                                                    placeholder="New Skill Group"
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
                                                <FieldLabel htmlFor="group-description">
                                                    Description
                                                </FieldLabel>

                                                <Textarea
                                                    id="group-description"
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
                                    <Field orientation="horizontal">
                                        <MutationButton
                                            type="submit"
                                            form="skill-group-form"
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
