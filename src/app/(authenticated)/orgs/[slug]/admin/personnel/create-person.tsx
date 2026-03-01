// filepath: /Users/awestphal/projects/avut/src/app/(authenticated)/orgs/[slug]/admin/personnel/create-person.tsx
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
import { Show } from "@/components/show";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { useOrganization } from "@/hooks/use-organization";
import {
    ModifiablePersonData,
    PersonData,
    PersonId,
} from "@/lib/schemas/person";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export function AdminModule_CreatePerson_Dialog(props: DialogProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(PersonData.modifiableSchema),
        defaultValues: {
            name: "",
            email: "",
            tags: [],
            properties: {},
        },
    });

    const mutation = useMutation(
        trpc.personnel.createPerson.mutationOptions({
            onError(error) {
                if (error.shape?.cause?.name == "FieldConflictError") {
                    form.setError(
                        error.shape.cause.message as keyof ModifiablePersonData,
                        { message: error.message },
                    );
                } else {
                    toast.error(`Failed to create person: ${error.message}`);
                    console.error("Failed to create person:", error);
                }
            },
            async onSuccess({ created }) {
                await queryClient.invalidateQueries(
                    trpc.personnel.listPersonnel.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                props.onOpenChange?.(false);
                form.reset();

                router.push(
                    Paths.org(organization.slug).admin.person(created.id).index
                        .href,
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit((formData) => {
        mutation.mutate({
            organizationId: organization.id,
            personId: PersonId.create(),
            create: formData,
        });
    });

    function handleCancel() {
        form.reset();
        props.onOpenChange?.(false);
    }

    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Person</DialogTitle>
                    <DialogDescription>Create a new person.</DialogDescription>
                </DialogHeader>
                <form id="create-person-form" onSubmit={handleSubmit}>
                    <FieldGroup>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="person-name">
                                        Name
                                    </FieldLabel>
                                    <Input
                                        id="person-name"
                                        autoFocus
                                        autoComplete="off"
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
                            name="email"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="person-email">
                                        Email
                                    </FieldLabel>
                                    <Input
                                        id="person-email"
                                        type="email"
                                        autoComplete="off"
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
                        <Field orientation="horizontal">
                            <MutationButton
                                type="submit"
                                form="create-person-form"
                                status={mutation.status}
                                text={{
                                    idle: "Create",
                                    pending: "Creating",
                                    success: "Created",
                                }}
                            />
                            <Show when={mutation.isIdle}>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCancel}
                                >
                                    Cancel
                                </Button>
                            </Show>
                        </Field>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}
