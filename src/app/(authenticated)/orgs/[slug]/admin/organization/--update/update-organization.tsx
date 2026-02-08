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
import { FieldValue } from "@/components/ui/field-value";
import { Link } from "@/components/ui/link";

import {
    ModifiableOrganizationData,
    OrganizationData,
} from "@/lib/schemas/organization";

import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export function AdminModule_UpdateOrganization_Form({
    organization,
}: {
    organization: OrganizationData;
}) {
    const queryClient = useQueryClient();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(OrganizationData.modifiableSchema),
        defaultValues: organization,
    });

    const mutation = useMutation(
        trpc.organizations.updateOrganization.mutationOptions({
            async onError(error: any) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause
                            .message as keyof ModifiableOrganizationData,
                        { message: error.message },
                    );
                }
            },
            async onSuccess() {
                router.push(
                    Paths.org(organization.slug).admin.organization.href,
                );
                queryClient.invalidateQueries(
                    trpc.organizations.getOrganization.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit(async (formData) => {
        toast.promise(
            async () => {
                await mutation.mutateAsync({
                    organizationId: organization.id,
                    ...formData,
                });
            },
            {
                loading: "Updating organization...",
                success: "Organization updated",
                error: "Failed to update organization",
            },
        );
    });

    return (
        <form id="update-organization-form" onSubmit={handleSubmit}>
            <FieldGroup>
                <Field orientation="responsive">
                    <FieldLabel>Organization ID</FieldLabel>
                    <FieldValue className="min-w-1/2" format="id">
                        {organization.id}
                    </FieldValue>
                </Field>
                <Controller
                    name="name"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field
                            data-invalid={fieldState.invalid}
                            orientation="responsive"
                        >
                            <FieldLabel htmlFor="organization-name">
                                Name
                            </FieldLabel>
                            <Input
                                id="organization-name"
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
                    name="slug"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field
                            data-invalid={fieldState.invalid}
                            orientation="responsive"
                        >
                            <FieldLabel htmlFor="organization-slug">
                                Slug
                            </FieldLabel>
                            <Input
                                id="organization-slug"
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
                        form="update-organization-form"
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
                            to={Paths.org(organization.slug).admin.organization}
                        >
                            Cancel
                        </Link>
                    </Button>
                </Field>
            </FieldGroup>
        </form>
    );
}
