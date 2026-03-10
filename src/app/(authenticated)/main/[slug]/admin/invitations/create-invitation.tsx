/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { useOrganization } from "@/hooks/use-organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { trpc } from "@/trpc/client";
import { useEffect } from "react";

const schema = z.object({
    email: z.email(),
    role: z.enum(["admin", "member"]),
});

export function AdminModule_CreateInvitation_Dialog(props: DialogProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            email: "",
            role: "member" as const,
        },
    });

    const mutation = useMutation(
        trpc.invitations.createInvitation.mutationOptions({
            onError(error) {
                if (error.data?.conflict) {
                    form.setError(
                        error.data.conflict.fieldName as keyof z.infer<
                            typeof schema
                        >,
                        { message: error.data.conflict.message },
                    );
                } else {
                    toast.error(
                        `Failed to create invitation: ${error.message}`,
                    );
                    console.error("Failed to create invitation:", error);
                }
            },
            async onSuccess({ created }) {
                toast.success(`Invitation sent to ${created.email}`);

                await queryClient.invalidateQueries(
                    trpc.organizations.listOrganizationInvitations.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                props.onOpenChange?.(false);
            },
        }),
    );

    useEffect(() => {
        if (!props.open) {
            form.reset();
            mutation.reset();
        }
    }, [props.open]);

    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Invitation</DialogTitle>
                    <DialogDescription>
                        Invite a new user to the organization.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="create-invitation-form"
                    onSubmit={form.handleSubmit((formData) => {
                        mutation.mutate({
                            organizationId: organization.id,
                            ...formData,
                        });
                    })}
                >
                    <FieldGroup>
                        <Controller
                            name="email"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    orientation="responsive"
                                >
                                    <FieldLabel htmlFor="email">
                                        Email Address
                                    </FieldLabel>
                                    <Input
                                        id="email"
                                        className="min-w-1/2"
                                        placeholder="example@email.com"
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
                            name="role"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field
                                    data-invalid={fieldState.invalid}
                                    orientation="responsive"
                                >
                                    <FieldLabel htmlFor="role-select">
                                        Role
                                    </FieldLabel>
                                    <Select
                                        value={field.value}
                                        onValueChange={field.onChange}
                                    >
                                        <SelectTrigger
                                            aria-invalid={fieldState.invalid}
                                            className="min-w-1/2"
                                            id="role-select"
                                        >
                                            <SelectValue placeholder="Select role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {OrganizationRole.options
                                                .filter(
                                                    (role) =>
                                                        role.isAdminAssignable,
                                                )
                                                .map((role) => (
                                                    <SelectItem
                                                        key={role.value}
                                                        value={role.value}
                                                    >
                                                        {role.label}
                                                    </SelectItem>
                                                ))}
                                        </SelectContent>
                                    </Select>
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
                                form="create-invitation-form"
                                status={mutation.status}
                                text={{
                                    idle: "Send",
                                    pending: "Sending",
                                    success: "Sent",
                                }}
                            />
                            <DialogCloseButton variant="outline">
                                Cancel
                            </DialogCloseButton>
                        </Field>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}
