/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/components/ui/link";
import { FieldValue } from "@/components/ui/field-value";

import { OrganizationData } from "@/lib/schemas/organization";
import {
    ModifiableSkillPackage,
    SkillPackage,
} from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";

import { trpc } from "@/trpc/client";

type SkillPackageAuthor_UpdatePackage_FormProps = {
    organization: OrganizationData;
    skillPackage: SkillPackage;
};

export function SkillPackageAuthor_UpdatePackage_Form({
    organization,
    skillPackage,
}: SkillPackageAuthor_UpdatePackage_FormProps) {
    const queryClient = useQueryClient();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(SkillPackage.modifiableSchema),
        defaultValues: skillPackage,
    });

    const mutation = useMutation(
        trpc.skills.updatePackage.mutationOptions({
            async onError(error) {
                console.error("Failed to update skill package", error);
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause
                            .message as keyof ModifiableSkillPackage,
                        { message: error.message },
                    );
                }
            },
            async onSuccess() {
                queryClient.invalidateQueries(
                    trpc.skills.getPackage.queryFilter({
                        skillPackageId: skillPackage.id,
                    }),
                );
                router.push(
                    Paths.org(
                        organization.slug,
                    ).skillPackageAuthor.skillPackage(skillPackage.id).href,
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        toast.promise(
            async () => {
                await mutation.mutateAsync({
                    organizationId: organization.id,
                    skillPackageId: skillPackage.id,
                    update: formData,
                });
            },
            {
                loading: "Updating skill package...",
                success: "Skill package updated",
                error: (error) =>
                    `Failed to update skill package: ${error.message}`,
            },
        );
    });

    return (
        <form id="update-skill-package-form" onSubmit={handleSubmit}>
            <FieldGroup>
                <Field orientation="responsive">
                    <FieldLabel>Skill Package ID</FieldLabel>
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
                        form="update-skill-package-form"
                        disabled={mutation.isPending}
                    >
                        Update
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => form.reset()}
                        asChild
                    >
                        <Link
                            to={Paths.org(
                                organization.slug,
                            ).skillPackageAuthor.skillPackage(skillPackage.id)}
                        >
                            Cancel
                        </Link>
                    </Button>
                </Field>
            </FieldGroup>
        </form>
    );
}
