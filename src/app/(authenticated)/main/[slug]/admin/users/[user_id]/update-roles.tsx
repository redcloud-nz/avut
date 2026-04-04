/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { Show } from "@/components/show";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend } from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ObjectName } from "@/components/ui/typography";

import { useOrganization } from "@/hooks/use-organization";
import { OrganizationMembershipData } from "@/lib/schemas/organization-member";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { UserData } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

interface AdminModule_UpdateUserRoles_Dialog_Props extends Omit<DialogProps, "children"> {
    organizationMember: OrganizationMembershipData;
    user: UserData;
    currentUserMembership: OrganizationMembershipData;
}

const schema = z.object({
    primaryRole: z.enum(["owner", "admin", "member"]),
    i3Role: z.enum(["i3-admin", "i3-user"]).nullable(),
    skillsRole: z.enum(["skills-admin", "skills-assessor"]).nullable(),
    skillPackageRole: z.enum(["skill-package-author"]).nullable(),
});

export default function AdminModule_UpdateUserRoles_Dialog({
    organizationMember,
    user,
    currentUserMembership,
    ...props
}: AdminModule_UpdateUserRoles_Dialog_Props) {
    const organization = useOrganization();

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            primaryRole: organizationMember.role.find(
                (v) => v === "owner" || v === "admin" || v === "member",
            )!,
            i3Role:
                organizationMember.role.find((v) => v === "i3-admin" || v === "i3-user") ?? null,
            skillsRole:
                organizationMember.role.find(
                    (v) => v === "skills-admin" || v === "skills-assessor",
                ) ?? null,
            skillPackageRole:
                organizationMember.role.find((v) => v === "skill-package-author") ?? null,
        },
    });

    const mutation = useMutation({
        mutationFn: async (formData: z.infer<typeof schema>) => {
            const { data, error } = await authClient.organization.updateMemberRole({
                organizationId: organization.id,
                memberId: organizationMember.id,
                role: [
                    formData.primaryRole,
                    formData.i3Role,
                    formData.skillsRole,
                    formData.skillPackageRole,
                ].filter((r): r is OrganizationRole => r !== null),
            });

            if (error) toast.error("Failed to update user role.");
            else toast.success("User role updated successfully.");
        },
        onSuccess: async (_data, _variables, _onMutateResult, context) => {
            props.onOpenChange?.(false);

            await context.client.invalidateQueries(
                trpc.organizations.listOrganizationMembers.queryFilter({
                    organizationId: organization.id,
                }),
            );
        },
    });

    function handleOpenChange(open: boolean) {
        if (!open) {
            form.reset();
            mutation.reset();
        }

        props.onOpenChange?.(open);
    }

    const primaryRole = useWatch({
        control: form.control,
        name: "primaryRole",
    });

    return (
        <Dialog {...props} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Update user roles</DialogTitle>
                    <DialogDescription>
                        Select the roles for user <ObjectName>{user.name}</ObjectName> within the
                        organization.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="update-user-roles-form"
                    onSubmit={form.handleSubmit((formData) => mutation.mutate(formData))}
                >
                    <FieldGroup>
                        <Controller
                            name="primaryRole"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field orientation="responsive" data-invalid={fieldState.invalid}>
                                    <FieldLabel>Primary Role</FieldLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger aria-invalid={fieldState.invalid}>
                                            <SelectValue placeholder="Select primary role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="owner">Owner</SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="member">Member</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />

                        <Show when={primaryRole == "member"}>
                            <FieldLegend>Module-specific Roles</FieldLegend>

                            {organization.settings.modules.i3.enabled && (
                                <Controller
                                    name="i3Role"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field orientation="responsive">
                                            <FieldLabel>I3 Module</FieldLabel>
                                            <Select
                                                value={field.value ?? "NONE"}
                                                onValueChange={(newValue) =>
                                                    field.onChange(
                                                        newValue === "NONE" ? null : newValue,
                                                    )
                                                }
                                            >
                                                <SelectTrigger aria-invalid={fieldState.invalid}>
                                                    <SelectValue placeholder="Select I3 module role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NONE">None</SelectItem>
                                                    <SelectItem value="i3-admin">
                                                        I3 Admin
                                                    </SelectItem>
                                                    <SelectItem value="i3-user">I3 User</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {fieldState.error && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                            )}
                            {organization.settings.modules.skills.enabled && (
                                <Controller
                                    name="skillsRole"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field orientation="responsive">
                                            <FieldLabel>Skills Module</FieldLabel>
                                            <Select
                                                value={field.value ?? "NONE"}
                                                onValueChange={(newValue) =>
                                                    field.onChange(
                                                        newValue === "NONE" ? null : newValue,
                                                    )
                                                }
                                            >
                                                <SelectTrigger aria-invalid={fieldState.invalid}>
                                                    <SelectValue placeholder="Select Skills module role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NONE">None</SelectItem>
                                                    <SelectItem value="skills-admin">
                                                        Skills Admin
                                                    </SelectItem>
                                                    <SelectItem value="skills-assessor">
                                                        Skills Assessor
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {fieldState.error && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                            )}
                            {organization.settings.modules["skill-package-builder"].enabled && (
                                <Controller
                                    name="skillPackageRole"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field orientation="responsive">
                                            <FieldLabel>Skill Package Builder Module</FieldLabel>
                                            <Select
                                                value={field.value ?? "NONE"}
                                                onValueChange={(newValue) =>
                                                    field.onChange(
                                                        newValue === "NONE" ? null : newValue,
                                                    )
                                                }
                                            >
                                                <SelectTrigger aria-invalid={fieldState.invalid}>
                                                    <SelectValue placeholder="Select Skill Package module role" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NONE">None</SelectItem>
                                                    <SelectItem value="skill-package-author">
                                                        Skill Package Author
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {fieldState.error && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                            )}
                        </Show>
                        <Field orientation="horizontal">
                            <MutationButton
                                type="submit"
                                form="update-user-roles-form"
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
                                onClick={() => handleOpenChange(false)}
                            >
                                Cancel
                            </Button>
                        </Field>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}
