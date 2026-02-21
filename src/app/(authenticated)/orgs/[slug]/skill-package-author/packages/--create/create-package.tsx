/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import { Textarea } from "@/components/ui/textarea";

import { OrganizationData } from "@/lib/schemas/organization";
import {
    ModifiableSkillPackage,
    SkillPackage,
    SkillPackageId,
} from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

type AdminModule_CreatePerson_FormProps = {
    organization: OrganizationData;
};

export function SkillPackageAuthor_PackageCreate_Form({
    organization,
}: AdminModule_CreatePerson_FormProps) {
    const queryClient = useQueryClient();
    const router = useRouter();

    const packageId = useMemo(() => SkillPackageId.create(), []);

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
        trpc.skills.createPackage.mutationOptions({
            async onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause
                            .message as keyof ModifiableSkillPackage,
                        { message: error.message },
                    );
                } else {
                    toast.error("An unexpected error occurred.");
                }
            },
            async onSuccess(skillPackage) {
                queryClient.invalidateQueries(
                    trpc.skills.listPackages.queryFilter(),
                );
                router.push(
                    Paths.org(
                        organization.slug,
                    ).skillPackageAuthor.skillPackage(skillPackage.id).href,
                );
            },
        }),
    );

    const handleCreate = form.handleSubmit((formData) => {
        toast.promise(
            async () => {
                await mutation.mutateAsync({
                    id: packageId,
                    organizationId: organization.id,
                    ...formData,
                });
            },
            {
                loading: "Creating skill package...",
                success: "Skill package created!",
                error: (error) =>
                    `Failed to create skill package: ${error.message}`,
            },
        );
    });

    return (
        <form id="create-package-form" onSubmit={handleCreate}>
            <FieldGroup>
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
                                aria-invalid={fieldState.invalid}
                                className="min-w-1/2"
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
                                className="min-w-1/2"
                                {...field}
                            />
                            {fieldState.error && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
                <Field orientation="horizontal">
                    <Button
                        type="submit"
                        form="create-package-form"
                        disabled={mutation.isPending}
                    >
                        Create
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => form.reset()}
                        asChild
                    >
                        <Link
                            to={
                                Paths.org(organization.slug).skillPackageAuthor
                                    .skillPackages
                            }
                        >
                            Cancel
                        </Link>
                    </Button>
                </Field>
            </FieldGroup>
        </form>
    );
}
