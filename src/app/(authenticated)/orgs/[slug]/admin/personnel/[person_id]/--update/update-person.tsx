/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import {
    useMutation,
    useQueryClient,
    useSuspenseQueries,
} from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import { FieldValue } from "@/components/ui/field-value";
import { Spinner } from "@/components/ui/spinner";

import { OrganizationData } from "@/lib/schemas/organization";
import { PersonData, PersonId } from "@/lib/schemas/person";
import * as Paths from "@/paths";

import { trpc } from "@/trpc/client";

type AdminModule_UpdatePerson_FormProps = {
    organization: OrganizationData;
    personId: PersonId;
};

export function AdminModule_UpdatePerson_Form({
    organization,
    personId,
}: AdminModule_UpdatePerson_FormProps) {
    const [{ data: person }] = useSuspenseQueries({
        queries: [
            trpc.personnel.getPerson.queryOptions({
                organizationId: organization.id,
                personId,
            }),
        ],
    });

    const queryClient = useQueryClient();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(
            PersonData.schema.pick({
                name: true,
                email: true,
                tags: true,
                properties: true,
            }),
        ),
        defaultValues: person,
    });

    const mutation = useMutation(
        trpc.personnel.updatePerson.mutationOptions({
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
                        `Failed to update person: ${error.message || "Unknown error"}`,
                    );
                }
            },
            async onSuccess() {
                toast.success("Person updated successfully.");
                await Promise.all([
                    queryClient.invalidateQueries(
                        trpc.personnel.getPerson.queryFilter({
                            organizationId: organization.id,
                            personId,
                        }),
                    ),
                    queryClient.invalidateQueries(
                        trpc.personnel.listPersonnel.queryFilter({
                            organizationId: organization.id,
                        }),
                    ),
                ]);

                router.push(
                    Paths.org(organization.slug).admin.person(personId).href,
                );
            },
        }),
    );

    return (
        <form
            id="update-person-form"
            onSubmit={form.handleSubmit((formData) =>
                mutation.mutate({
                    organizationId: organization.id,
                    id: personId,
                    ...formData,
                }),
            )}
        >
            <FieldGroup>
                <Field orientation="responsive">
                    <FieldLabel>Person ID</FieldLabel>
                    <FieldValue className="min-w-1/2">{person.id}</FieldValue>
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
                            <FieldLabel htmlFor="person-email">
                                Email
                            </FieldLabel>
                            <Input
                                id="person-email"
                                type="email"
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
                        form="update-person-form"
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? (
                            <>
                                <Spinner /> Updating...
                            </>
                        ) : (
                            "Update"
                        )}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => form.reset()}
                        asChild
                    >
                        <Link
                            to={Paths.org(organization.slug).admin.person(
                                personId,
                            )}
                        >
                            Cancel
                        </Link>
                    </Button>
                </Field>
            </FieldGroup>
        </form>
    );
}
