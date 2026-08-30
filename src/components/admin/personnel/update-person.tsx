/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { ObjectIcons } from "@/components/icons";
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
import { FieldValue } from "@/components/ui/field-value";
import { Input } from "@/components/ui/input";

import { personnelEffects } from "@/client/personnel-effects";
import { useOrganization } from "@/hooks/use-organization";
import { ModifiablePersonData, PersonData } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

export function AdminModule_UpdatePerson_Dialog({ person }: { person: PersonData }) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["update"] as const));
    const dialogOpen = action === "update";

    const form = useForm({
        resolver: zodResolver(PersonData.modifiableSchema),
        defaultValues: person,
    });

    const mutation = useMutation(
        trpc.personnel.updatePerson.mutationOptions({
            meta: { effects: personnelEffects.updatePerson },
            async onError(error) {
                if (error.data?.conflict) {
                    form.setError(error.data.conflict.fieldName as keyof ModifiablePersonData, {
                        message: error.data.conflict.message,
                    });
                } else {
                    console.error("Failed to update person", error);
                    toast.error(`Failed to update person: ${error.message}`);
                }
            },
            async onSuccess() {
                toast.success("Person updated");
                handleOpenChange(false);
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        if (open) {
            void setAction("update", { history: "push" });
        } else {
            form.reset();
            mutation.reset();
            void setAction(null, { history: "replace" });
        }
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update person</DialogTitle>
                    <DialogDescription>Update the details of this person record.</DialogDescription>
                </DialogHeader>
                <form
                    id="update-person-form"
                    onSubmit={form.handleSubmit(
                        (formData) =>
                            mutation.mutate({
                                organizationId: organization.id,
                                personId: person.id,
                                update: formData,
                            }),
                        (errors) => {
                            console.error("Form validation errors:", errors);
                        },
                    )}
                >
                    <FieldGroup>
                        <Field>
                            <FieldLabel>Person ID</FieldLabel>
                            <FieldValue value={person.id} format="id" />
                        </Field>
                        <Controller
                            name="name"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor="person-name">Name</FieldLabel>
                                    <Input
                                        id="person-name"
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
                                        aria-invalid={fieldState.invalid}
                                        className="min-w-1/2"
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
                        form="update-person-form"
                        status={mutation.status}
                        text={{
                            idle: "Update",
                            pending: "Updating...",
                            success: "Updated",
                        }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
