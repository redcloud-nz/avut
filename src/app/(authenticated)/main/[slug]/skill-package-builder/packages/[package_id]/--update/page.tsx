/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/skill-package-builder/packages/[package_id]/--update
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { useOrganization } from "@/hooks/use-organization";
import { useSkillPackage } from "@/hooks/use-skill-package";
import { route } from "@/lib/routes";
import { ModifiableSkillPackage, SkillPackage } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

/**
 * Page for updating an existing skill package. Fetches the skill package data and renders the update form.
 * On form submission, updates the skill package in the database and navigates back to the package page.
 */
export default function SkillPackageBuilder_UpdatePackage_Page(
    props: PageProps<`/main/[slug]/skill-package-builder/packages/[package_id]/--update`>,
) {
    const { slug, package_id } = use(props.params);
    const skillPackage = useSkillPackage(package_id);

    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(SkillPackage.modifiableSchema),
        defaultValues: skillPackage,
    });

    const updateMutation = useMutation(
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
                await queryClient.invalidateQueries(
                    trpc.skillPackageBuilder.listPackages.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                router.push(
                    route("/main/[slug]/skill-package-builder/packages/[package_id]", {
                        slug: organization.slug,
                        package_id: skillPackage.id,
                    }),
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        updateMutation.mutate({
            skillPackageId: skillPackage.id,
            organizationId: organization.id,
            update: formData,
        });
    });

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    {
                        label: "Skill Package Builder",
                        href: route("/main/[slug]/skill-package-builder", { slug }),
                    },
                    {
                        label: skillPackage.name,
                        href: route("/main/[slug]/skill-package-builder/packages/[package_id]", {
                            slug,
                            package_id: skillPackage.id,
                        }),
                    },
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            href={route(
                                "/main/[slug]/skill-package-builder/packages/[package_id]",
                                { slug, package_id: skillPackage.id },
                            )}
                            tooltip="Back to skill package"
                        />
                        <Hermes.Title>{skillPackage.name}</Hermes.Title>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Update Skill Package</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form id="update-skill-package-form" onSubmit={handleSubmit}>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldLabel>Package ID</FieldLabel>
                                        <FieldValue value={skillPackage.id} format="id" />
                                    </Field>
                                    <Controller
                                        name="name"
                                        control={form.control}
                                        render={({ field, fieldState }) => (
                                            <Field
                                                data-invalid={fieldState.invalid}
                                                orientation="responsive"
                                            >
                                                <FieldLabel htmlFor="package-name">Name</FieldLabel>
                                                <Input
                                                    id="package-name"
                                                    autoFocus
                                                    aria-invalid={fieldState.invalid}
                                                    {...field}
                                                />
                                                {fieldState.error && (
                                                    <FieldError errors={[fieldState.error]} />
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
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
                                            </Field>
                                        )}
                                    />
                                    <Field orientation="horizontal">
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
                                        <Show when={updateMutation.isIdle}>
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
