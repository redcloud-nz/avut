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
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Show } from "@/components/show";
import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
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
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { OrganizationUser } from "@/lib/schemas/organization-user";
import { trpc } from "@/trpc/client";

interface AdminModule_UpdateRoles_DialogProps extends Omit<DialogProps, "children"> {
    personName: string;
    defaultRoles: OrganizationRole[];
    title: string;
    mutationFn: (roles: OrganizationRole[]) => Promise<void>;
    currentUser: OrganizationUser;
}

const schema = z.object({
    primaryRole: z.enum(["owner", "admin", "member"]),
    i3Role: z.enum(["i3-admin", "i3-user"]).nullable(),
    skillsRole: z.enum(["skills-admin", "skills-assessor"]).nullable(),
    skillPackageRole: z.enum(["skill-package-author"]).nullable(),
});

export function AdminModule_UpdateRoles_Dialog({
    personName,
    defaultRoles,
    title,
    mutationFn,
    currentUser,
    ...props
}: AdminModule_UpdateRoles_DialogProps) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const canAssignOwner = currentUser.roles.includes("owner");

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            primaryRole: defaultRoles.find(
                (v) => v === "owner" || v === "admin" || v === "member",
            )!,
            i3Role: defaultRoles.find((v) => v === "i3-admin" || v === "i3-user") ?? null,
            skillsRole:
                defaultRoles.find((v) => v === "skills-admin" || v === "skills-assessor") ?? null,
            skillPackageRole: defaultRoles.find((v) => v === "skill-package-author") ?? null,
        },
    });

    const mutation = useMutation({
        mutationFn: async (formData: z.infer<typeof schema>) => {
            const roles = [
                formData.primaryRole,
                formData.i3Role,
                formData.skillsRole,
                formData.skillPackageRole,
            ].filter((r): r is OrganizationRole => r !== null);

            await mutationFn(roles);
        },
        onError(error) {
            console.error("Failed to update roles:", error);
            toast.error("Failed to update roles.");
        },
        async onSuccess() {
            toast.success(
                <>
                    Roles updated for <ObjectName>{personName}</ObjectName>.
                </>,
            );
            props.onOpenChange?.(false);

            await queryClient.invalidateQueries(
                trpc.accessControl.listPersonnelWithAccess.queryFilter({
                    organizationId: organization.id,
                }),
            );

            mutation.reset();
        },
    });

    function handleOpenChange(open: boolean) {
        if (!open) {
            form.reset();
            mutation.reset();
        }

        props.onOpenChange?.(open);
    }

    const primaryRole = useWatch({ control: form.control, name: "primaryRole" });

    return (
        <Dialog {...props} onOpenChange={handleOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>
                        Select the roles for <ObjectName>{personName}</ObjectName> within the
                        organization.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="update-roles-form"
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
                                            <SelectItem value="owner" disabled={!canAssignOwner}>
                                                Owner
                                            </SelectItem>
                                            <SelectItem value="admin">Admin</SelectItem>
                                            <SelectItem value="member">Member</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </Field>
                            )}
                        />

                        <Show when={primaryRole === "member"}>
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
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="update-roles-form"
                        status={mutation.status}
                        text={{
                            idle: "Update",
                            pending: "Updating",
                            success: "Updated",
                        }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
