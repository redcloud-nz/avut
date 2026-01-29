/*
 *  Copyright (c) 2025 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient, useSuspenseQueries } from "@tanstack/react-query";

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

import { authClient } from "@/lib/auth-client";
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
    const [{ data: invitations }, { data: members }] = useSuspenseQueries({
        queries: [
            trpc.organizations.listOrganizationInvitations.queryOptions({
                organizationId: organization.id,
            }),
            trpc.organizations.listOrganizationMembers.queryOptions({
                organizationId: organization.id,
            }),
        ],
    });

    const queryClient = useQueryClient();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(
            z.object({
                email: z.email(),
                role: z.enum(["owner", "admin", "member"]),
            }),
        ),
        defaultValues: {
            email: "",
            role: "member" as const,
        },
    });

    const [status, setStatus] = useState<"Pending" | "Idle" | "Error">("Idle");

    const handleSubmit = form.handleSubmit(async (formData) => {
        setStatus("Pending");

        // Check if an invitation has already been sent to this email
        const existingInvitation = invitations.find(
            (invitation) =>
                invitation.email === formData.email &&
                invitation.status == "pending",
        );
        if (existingInvitation) {
            form.setError("email", {
                type: "manual",
                message: "An invitation has already been sent to this email.",
            });
            setStatus("Idle");
            return;
        }

        // Check if a member with this email already exists
        const existingMember = members.find(
            (member) => member.user.email === formData.email,
        );
        if (existingMember) {
            form.setError("email", {
                type: "manual",
                message: "A member with this email already exists.",
            });
            setStatus("Idle");
            return;
        }

        const { data, error } = await authClient.organization.inviteMember({
            email: formData.email,
            role: formData.role,
            organizationId: organization.id,
        });

        if (error) toast.error("Failed to send invitation. Please try again.");
        else
            toast.success(`Invitation successfully sent to ${formData.email}.`);

        setStatus("Idle");
        queryClient.invalidateQueries(
            trpc.organizations.listOrganizationInvitations.queryFilter({
                organizationId: organization.id,
            }),
        );
        router.push(Paths.org(organization.slug).admin.invitations.href);
    });

    return (
        <form id="create-invitation-form" onSubmit={handleSubmit}>
            <FieldGroup>
                <Controller
                    name="email"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="email">
                                Email Address
                            </FieldLabel>
                            <FieldDescription>
                                Enter the email address of the user you want to
                                invite.
                            </FieldDescription>
                            <Input
                                id="email"
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
