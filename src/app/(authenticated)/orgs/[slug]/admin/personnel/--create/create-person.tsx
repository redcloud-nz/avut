/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
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
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";

import { OrganizationData } from "@/lib/schemas/organization";
import * as Paths from "@/paths";

import { trpc } from "@/trpc/client";
import { PersonData, PersonId } from "@/lib/schemas/person";
import { FieldValue } from "@/components/ui/field-value";

type AdminModule_CreatePerson_FormProps = {
    organization: OrganizationData;
};

export function AdminModule_CreatePerson_Form({
    organization,
}: AdminModule_CreatePerson_FormProps) {
    const queryClient = useQueryClient();
    const router = useRouter();

    const personId = useMemo(() => PersonId.create(), []);

    const form = useForm({
        resolver: zodResolver(PersonData.modifiableSchema),
        defaultValues: {
            name: "",
            email: "",
            tags: [],
            properties: {},
        },
    });

    const createPersonMutation = useMutation(
        trpc.personnel.createPerson.mutationOptions({
            async onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause.message as keyof Pick<
                            PersonData,
                            "name" | "email" | "tags" | "properties"
                        >,
                        { message: error.shape.message },
                    );
                } else {
                    toast.error(
                        `Error creating person record: ${error.message}`,
                    );
                }
            },
            async onSuccess() {
                queryClient.invalidateQueries(
                    trpc.personnel.listPersonnel.queryFilter({
                        organizationId: organization.id,
                    }),
                );
                toast.success("Person record created successfully.");
                router.push(
                    Paths.org(organization.slug).admin.person(personId).href,
                );
            },
        }),
    );

    return (
        <form
            id="create-person-form"
            onSubmit={form.handleSubmit((formData) =>
                createPersonMutation.mutate({
                    organizationId: organization.id,
                    personId,
                    ...formData,
                }),
            )}
        >
            <FieldGroup>
                <Field orientation="responsive">
                    <FieldLabel>Person ID</FieldLabel>
                    <FieldValue className="min-w-1/2">{personId}</FieldValue>
                </Field>
                <Controller
                    name="name"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field
                            data-invalid={fieldState.invalid}
                            orientation="responsive"
                        >
                            <FieldLabel htmlFor="person-name">Name</FieldLabel>

                            <Input
                                id="person-name"
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
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field
                            data-invalid={fieldState.invalid}
                            orientation="responsive"
                        >
                            <FieldContent>
                                <FieldLabel htmlFor="person-email">
                                    Email
                                </FieldLabel>
                                <FieldDescription>
                                    Must be unique within the organization.
                                </FieldDescription>
                                {fieldState.error && (
                                    <FieldError errors={[fieldState.error]} />
                                )}
                            </FieldContent>

                            <Input
                                id="person-email"
                                type="email"
                                aria-invalid={fieldState.invalid}
                                className="min-w-1/2"
                                {...field}
                            />
                        </Field>
                    )}
                />
                <Field orientation="horizontal">
                    <Button
                        type="submit"
                        form="create-person-form"
                        disabled={createPersonMutation.isPending}
                    >
                        Create
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => form.reset()}
                        asChild
                    >
                        <Link to={Paths.org(organization.slug).admin.personnel}>
                            Cancel
                        </Link>
                    </Button>
                </Field>
            </FieldGroup>
        </form>
    );
}
