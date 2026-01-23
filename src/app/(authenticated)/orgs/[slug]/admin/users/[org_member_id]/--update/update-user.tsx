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

import { S2_Button } from "@/components/ui/s2-button";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Link } from "@/components/ui/link";
import {
    S2_Select,
    S2_SelectContent,
    S2_SelectItem,
    S2_SelectTrigger,
    S2_SelectValue,
} from "@/components/ui/s2-select";
import { S2_Value } from "@/components/ui/s2-value";

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
                                <S2_Value value="Owner" />
                            ) : (
                                <S2_Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                >
                                    <S2_SelectTrigger
                                        aria-invalid={fieldState.invalid}
                                        id="role"
                                    >
                                        <S2_SelectValue placeholder="Select a role" />
                                    </S2_SelectTrigger>
                                    <S2_SelectContent>
                                        <S2_SelectItem value="admin">
                                            Admin
                                        </S2_SelectItem>
                                        <S2_SelectItem value="member">
                                            Member
                                        </S2_SelectItem>
                                    </S2_SelectContent>
                                </S2_Select>
                            )}
                            {fieldState.error && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />
                <Field orientation="horizontal">
                    <S2_Button
                        type="submit"
                        form="update-user-form"
                        disabled={!form.formState.isDirty || mutation.isPending}
                    >
                        Update
                    </S2_Button>
                    <S2_Button
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
                    </S2_Button>
                </Field>
            </FieldGroup>
        </form>
    );
}
