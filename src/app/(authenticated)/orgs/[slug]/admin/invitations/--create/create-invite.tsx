/*
 *  Copyright (c) 2025 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { OrganizationData } from "@/lib/schemas/organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import * as Paths from "@/paths";

import { trpc } from "@/trpc/client";

type AdminModule_CreateInvitation_FormProps = {
    organization: OrganizationData;
};

export function AdminModule_CreateInvitation_Form({
    organization,
}: AdminModule_CreateInvitation_FormProps) {
    const queryClient = useQueryClient();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(
            z.object({
                email: z.email(),
                role: z.enum(["admin", "member"]),
            }),
        ),
        defaultValues: {
            email: "",
            role: "member" as const,
        },
    });

    const mutation = useMutation(
        trpc.invitations.createInvitation.mutationOptions({
            async onSettled() {
                await queryClient.invalidateQueries(
                    trpc.organizations.listOrganizationInvitations.queryFilter({
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
                    email: formData.email,
                    role: formData.role,
                });
                router.push(
                    Paths.org(organization.slug).admin.invitations.href,
                );
            },
            {
                loading: "Sending invitation...",
                success: `Invitation sent to ${form.getValues("email")}`,
                error: (error) => "Failed to send invitation: " + error.message,
            },
        );
    });

    return (
        <form id="create-invitation-form" onSubmit={handleSubmit}>
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
                    name="role"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field
                            data-invalid={fieldState.invalid}
                            orientation="responsive"
                        >
                            <FieldLabel htmlFor="role-select">Role</FieldLabel>
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
                                            (role) => role.isAdminAssignable,
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
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Field orientation="horizontal">
                    <Button
                        type="submit"
                        form="create-invitation-form"
                        disabled={status == "Pending"}
                    >
                        Send Invitation
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => form.reset()}
                        asChild
                    >
                        <Link
                            to={Paths.org(organization.slug).admin.invitations}
                        >
                            Cancel
                        </Link>
                    </Button>
                </Field>
            </FieldGroup>
        </form>
    );
}
