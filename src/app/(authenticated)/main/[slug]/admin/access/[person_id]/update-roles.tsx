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
import { Checkbox } from "@/components/ui/checkbox";
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
    i3Role: z.enum(["i3-editor"]).nullable(),
    skillsRole: z.enum(["skills-assessor"]).nullable(),
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
            i3Role: defaultRoles.find((v) => v === "i3-editor") ?? null,
            skillsRole: defaultRoles.find((v) => v === "skills-assessor") ?? null,
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
                                        <Field
                                            orientation="horizontal"
                                            data-invalid={fieldState.invalid}
                                        >
                                            <Checkbox
                                                id="update-roles-i3"
                                                checked={field.value === "i3-editor"}
                                                onCheckedChange={(checked) =>
                                                    field.onChange(checked ? "i3-editor" : null)
                                                }
                                                aria-invalid={fieldState.invalid}
                                            />
                                            <FieldLabel htmlFor="update-roles-i3">
                                                {OrganizationRole.displayNames["i3-editor"]}
                                            </FieldLabel>
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
                                        <Field
                                            orientation="horizontal"
                                            data-invalid={fieldState.invalid}
                                        >
                                            <Checkbox
                                                id="update-roles-skills"
                                                checked={field.value === "skills-assessor"}
                                                onCheckedChange={(checked) =>
                                                    field.onChange(
                                                        checked ? "skills-assessor" : null,
                                                    )
                                                }
                                                aria-invalid={fieldState.invalid}
                                            />
                                            <FieldLabel htmlFor="update-roles-skills">
                                                {OrganizationRole.displayNames["skills-assessor"]}
                                            </FieldLabel>
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
                                        <Field
                                            orientation="horizontal"
                                            data-invalid={fieldState.invalid}
                                        >
                                            <Checkbox
                                                id="update-roles-skill-package"
                                                checked={field.value === "skill-package-author"}
                                                onCheckedChange={(checked) =>
                                                    field.onChange(
                                                        checked ? "skill-package-author" : null,
                                                    )
                                                }
                                                aria-invalid={fieldState.invalid}
                                            />
                                            <FieldLabel htmlFor="update-roles-skill-package">
                                                {
                                                    OrganizationRole.displayNames[
                                                        "skill-package-author"
                                                    ]
                                                }
                                            </FieldLabel>
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
