/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/personnel/[person_id]/--update
 */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { Controller, useForm, Watch } from "react-hook-form";
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

import { useOrganization } from "@/hooks/use-organization";
import { usePerson } from "@/hooks/use-person";
import { route } from "@/lib/routes";
import { ModifiablePersonData, PersonData } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

export default function AdminModule_PersonUpdate_Page(
    props: PageProps<`/main/[slug]/admin/personnel/[person_id]/--update`>,
) {
    const { slug, person_id } = use(props.params);
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const person = usePerson(person_id);

    const form = useForm({
        resolver: zodResolver(PersonData.modifiableSchema),
        defaultValues: person,
    });

    const mutation = useMutation(
        trpc.personnel.updatePerson.mutationOptions({
            async onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(error.shape.cause.message as keyof ModifiablePersonData, {
                        message: error.message,
                    });
                } else {
                    console.error("Failed to update team", error);
                    toast.error(`Failed to update team: ${error.message}`);
                }
            },
            async onSuccess() {
                await queryClient.invalidateQueries(
                    trpc.personnel.listPersonnel.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                router.push(route("/main/[slug]/admin/personnel/[person_id]", { slug, person_id }));
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId: organization.id,
            personId: person_id,
            update: formData,
        });
    });

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    { label: "Admin", href: route("/main/[slug]/admin", { slug }) },
                    { label: "Personnel", href: route("/main/[slug]/admin/personnel", { slug }) },

                    {
                        label: person.name,
                        href: route("/main/[slug]/admin/personnel/[person_id]", {
                            slug,
                            person_id,
                        }),
                    },
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            href={route("/main/[slug]/admin/personnel/[person_id]", {
                                slug,
                                person_id,
                            })}
                            tooltip={`Back to person: ${person.name}`}
                        />
                        <Watch
                            control={form.control}
                            names={["name"]}
                            render={([name]) => <Hermes.Title>{name}</Hermes.Title>}
                        />
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Update Person</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form id="update-person-form" onSubmit={handleSubmit}>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldLabel>Person ID</FieldLabel>
                                        <FieldValue value={person.id} format="id" />
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
                                        <MutationButton
                                            type="submit"
                                            form="update-person-form"
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
                                                onClick={() => form.reset()}
                                                asChild
                                            >
                                                <Link
                                                    href={route(
                                                        "/main/[slug]/admin/personnel/[person_id]",
                                                        {
                                                            slug,
                                                            person_id: person.id,
                                                        },
                                                    )}
                                                >
                                                    Cancel
                                                </Link>
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
