/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CreateNewIcon } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { personnelEffects } from "@/client/personnel-effects";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { ModifiablePersonData, PersonData, PersonId } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

export function AdminModule_CreatePerson_Dialog() {
    const organization = useOrganization();
    const router = useRouter();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["create"] as const));
    const dialogOpen = action === "create";

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
            meta: { effects: personnelEffects.createPerson },
            onError(error) {
                if (error.data?.conflict) {
                    form.setError(error.data.conflict.fieldName as keyof ModifiablePersonData, {
                        message: error.data.conflict.message,
                    });
                } else {
                    toast.error(`Failed to create person: ${error.message}`);
                    console.error("Failed to create person:", error);
                }
            },
            onSuccess({ created }) {
                router.push(
                    route("/orgs/[slug]/admin/personnel/[person_id]", {
                        slug: organization.slug,
                        person_id: created.id,
                    }),
                );
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) => {
            mutation.mutate({
                organizationId: organization.id,
                personId: PersonId.create(),
                create: formData,
            });
        },
        (errors) => {
            console.error("Form validation errors:", errors);
        },
    );

    function handleOpenChange(open: boolean) {
        if (open) {
            void setAction("create", { history: "push" });
        } else {
            form.reset();
            mutation.reset();
            void setAction(null, { history: "replace" });
        }
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <CreateNewIcon /> <span className="hidden md:inline">New Person</span>
                </Button>
            </DialogTrigger>
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
                                    <FieldLabel htmlFor="person-name">Name</FieldLabel>
                                    <Input
                                        id="person-name"
                                        autoFocus
                                        autoComplete="off"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                        <Controller
                            name="email"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="person-email">Email</FieldLabel>
                                    <Input
                                        id="person-email"
                                        type="email"
                                        autoComplete="off"
                                        aria-invalid={fieldState.invalid}
                                        {...field}
                                    />
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
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
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
