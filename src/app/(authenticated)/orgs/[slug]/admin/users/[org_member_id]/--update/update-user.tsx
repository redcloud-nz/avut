/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
import { Link } from "@/components/ui/link";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { FieldValue } from "@/components/ui/field-value";

import { authClient } from "@/lib/auth-client";
import { formatDate } from "@/lib/datetime";
import { OrganizationData } from "@/lib/schemas/organization";
import { OrganizationMemberId } from "@/lib/schemas/organization-member";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import * as Paths from "@/paths";

import { trpc } from "@/trpc/client";

type AdminModule_UpdateUser_FormProps = {
    organization: OrganizationData;
    organizationMemberId: OrganizationMemberId;
};

export function AdminModule_UpdateUser_Form({
    organization,
    organizationMemberId,
}: AdminModule_UpdateUser_FormProps) {
    const [{ data: member }] = useSuspenseQueries({
        queries: [
            trpc.organizations.getOrganizationMember.queryOptions({
                organizationId: organization.id,
                organizationMemberId,
            }),
        ],
    });

    const queryClient = useQueryClient();
    const router = useRouter();

    const form = useForm({
        resolver: zodResolver(
            z.object({
                role: z.enum(["owner", "admin", "member"]),
            }),
        ),
        defaultValues: {
            role: member.role[0],
        },
    });

    const mutation = useMutation({
        mutationFn: async (formData: { role: OrganizationRole }) => {
            const { data, error } =
                await authClient.organization.updateMemberRole({
                    organizationId: organization.id,
                    memberId: organizationMemberId,
                    role: formData.role,
                });
            if (error) toast.error("Failed to update user role.");
            else toast.success("User role updated successfully.");
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries(
                trpc.organizations.getOrganizationMember.queryFilter({
                    organizationId: organization.id,
                    organizationMemberId,
                }),
            );
            queryClient.invalidateQueries(
                trpc.organizations.listOrganizationMembers.queryFilter({
                    organizationId: organization.id,
                }),
            );
            router.push(
                Paths.org(organization.slug).admin.user(organizationMemberId)
                    .href,
            );
        },
    });

    return (
        <form
            id="update-user-form"
            onSubmit={form.handleSubmit((formData) =>
                mutation.mutate(formData),
            )}
        >
            <FieldGroup>
                <Controller
                    name="role"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field
                            data-invalid={fieldState.invalid}
                            orientation="responsive"
                        >
                            <FieldLabel htmlFor="role">Primary Role</FieldLabel>
                            {field.value == "owner" ? (
                                <FieldValue value="Owner" />
                            ) : (
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                >
                                    <SelectTrigger
                                        aria-invalid={fieldState.invalid}
                                        id="role"
                                    >
                                        <SelectValue placeholder="Select a role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">
                                            Admin
                                        </SelectItem>
                                        <SelectItem value="member">
                                            Member
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                            {fieldState.error && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
                <Field orientation="horizontal">
                    <Button
                        type="submit"
                        form="update-user-form"
                        disabled={!form.formState.isDirty || mutation.isPending}
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
                            to={Paths.org(organization.slug).admin.user(
                                organizationMemberId,
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
