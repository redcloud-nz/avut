/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/admin/users/[user_id]/--update
 */
"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { Controller, useForm } from "react-hook-form";

import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Link } from "@/components/ui/link";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { useOrganization } from "@/hooks/use-organization";
import { authClient } from "@/client/auth-client";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";
import { useOrganizationMembership } from "@/hooks/use-organization-member";

export default function AdminModule_UpdateUser_Page(
    props: PageProps<`/main/[slug]/admin/users/[user_id]/--update`>,
) {
    const { slug, user_id } = use(props.params);
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const organizationMember = useOrganizationMembership(user_id);

    const form = useForm({
        resolver: zodResolver(
            z.object({
                role: z.enum(["owner", "admin", "member"]),
            }),
        ),
        defaultValues: {
            role: organizationMember.role[0],
        },
    });

    const mutation = useMutation({
        mutationFn: async (formData: { role: OrganizationRole }) => {
            const { data, error } = await authClient.organization.updateMemberRole({
                organizationId: organization.id,
                memberId: organizationMember.id,
                role: formData.role,
            });
            if (error) toast.error("Failed to update user role.");
            else toast.success("User role updated successfully.");
        },
        onSuccess: async () => {
            queryClient.invalidateQueries(
                trpc.organizations.listOrganizationMembers.queryFilter({
                    organizationId: organization.id,
                }),
            );
            router.push(Paths.main(organization.slug).admin.user(organizationMember.userId).href);
        },
    });

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(slug).admin.index,
                    Paths.main(slug).admin.users,
                    {
                        label: organizationMember.user.name || "User",
                        href: Paths.main(slug).admin.user(user_id).href,
                    },
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.Header>
                            <Hermes.BackButton
                                to={Paths.main(slug).admin.user(user_id)}
                                tooltip="Back to user details"
                            />
                            <Hermes.Title>{organizationMember.user.name || "User"}</Hermes.Title>
                        </Hermes.Header>
                        <Card>
                            <CardHeader>
                                <CardTitle>Update User</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form
                                    id="update-user-form"
                                    onSubmit={form.handleSubmit((formData) =>
                                        mutation.mutate(formData),
                                    )}
                                >
                                    <FieldGroup>
                                        <Field orientation="responsive">
                                            <FieldLabel>User ID</FieldLabel>
                                            <FieldValue value={organizationMember.id} format="id" />
                                        </Field>
                                        <Field orientation="responsive">
                                            <FieldLabel>Organisation Member ID</FieldLabel>
                                        </Field>
                                        <Controller
                                            name="role"
                                            control={form.control}
                                            render={({ field, fieldState }) => (
                                                <Field
                                                    data-invalid={fieldState.invalid}
                                                    orientation="responsive"
                                                >
                                                    <FieldLabel htmlFor="role">Role</FieldLabel>
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
                                            <MutationButton
                                                type="submit"
                                                form="update-user-form"
                                                status={mutation.status}
                                                text={{
                                                    idle: "Update",
                                                    pending: "Updating",
                                                    success: "Updated",
                                                }}
                                            />

                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => form.reset()}
                                                asChild
                                            >
                                                <Link
                                                    to={Paths.main(organization.slug).admin.user(
                                                        organizationMember.id,
                                                    )}
                                                >
                                                    Cancel
                                                </Link>
                                            </Button>
                                        </Field>
                                    </FieldGroup>
                                </form>
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
