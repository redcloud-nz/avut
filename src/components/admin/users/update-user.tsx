/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { ObjectIcons } from "@/components/icons";
import { Show } from "@/components/show";
import { Button, MutationButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
    FieldLegend,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ObjectName } from "@/components/ui/typography";

import { useOrganization } from "@/hooks/use-organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { type AuthOrganizationMember } from "@/server/auth";

export function AdminModule_UpdateUser_Dialog({
    organizationUser,
}: {
    organizationUser: AuthOrganizationMember;
}) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["update"] as const));
    const dialogOpen = action === "update";

    const form = useForm({
        resolver: zodResolver(
            z.object({
                primaryRole: OrganizationRole.primaryRoleSchema,
                secondaryRoles: z.array(OrganizationRole.secondaryRoleSchema),
            }),
        ),
        defaultValues: {
            primaryRole: OrganizationRole.getPrimaryRole(
                organizationUser.role.split(",") as OrganizationRole[],
            ),
            secondaryRoles: OrganizationRole.getSecondaryRoles(
                organizationUser.role.split(",") as OrganizationRole[],
            ),
        },
    });

    const mutation = useMutation({
        async mutationFn(roles: OrganizationRole[]) {
            await authClient.organization.updateMemberRole({
                role: roles,
                memberId: organizationUser.id,
                organizationId: organizationUser.organizationId,
            });
        },
        onError(error) {
            console.error("Failed to update user roles:", error);
        },
        onSuccess() {
            toast.success(
                <>
                    User <ObjectName>{organizationUser.user.name}</ObjectName> roles updated.
                </>,
            );

            queryClient.invalidateQueries({
                queryKey: ["auth", "organization-users", organizationUser.organizationId],
            });

            handleOpenChange(false);
        },
    });

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
                    <DialogTitle>Update User Roles</DialogTitle>
                    <DialogDescription>
                        Update the roles for user{" "}
                        <ObjectName>{organizationUser.user.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="update-user-form"
                    onSubmit={form.handleSubmit(
                        (data) => {
                            mutation.mutate([data.primaryRole, ...data.secondaryRoles]);
                        },
                        (errors) => {
                            console.error("Form validation errors:", errors);
                        },
                    )}
                >
                    <FieldGroup>
                        <Controller
                            name="primaryRole"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <>
                                    <RadioGroup
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        className="w-fit"
                                    >
                                        <FieldLegend variant="label">Primary Role</FieldLegend>
                                        <Field orientation="horizontal">
                                            <RadioGroupItem value="owner" id="primary-role-owner" />
                                            <FieldContent>
                                                <FieldLabel htmlFor="primary-role-owner">
                                                    {OrganizationRole.roles.owner.displayName}
                                                </FieldLabel>
                                                <FieldDescription>
                                                    {OrganizationRole.roles.owner.description}
                                                </FieldDescription>
                                            </FieldContent>
                                        </Field>
                                        <Field orientation="horizontal">
                                            <RadioGroupItem value="admin" id="primary-role-admin" />
                                            <FieldContent>
                                                <FieldLabel htmlFor="primary-role-admin">
                                                    {OrganizationRole.roles.admin.displayName}
                                                </FieldLabel>
                                                <FieldDescription>
                                                    {OrganizationRole.roles.admin.description}
                                                </FieldDescription>
                                            </FieldContent>
                                        </Field>
                                        <Field orientation="horizontal">
                                            <RadioGroupItem
                                                value="member"
                                                id="primary-role-member"
                                            />
                                            <FieldContent>
                                                <FieldLabel htmlFor="primary-role-member">
                                                    {OrganizationRole.roles.member.displayName}
                                                </FieldLabel>
                                                <FieldDescription>
                                                    {OrganizationRole.roles.member.description}
                                                </FieldDescription>
                                            </FieldContent>
                                        </Field>
                                        {fieldState.error && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </RadioGroup>
                                </>
                            )}
                        />
                        <Controller
                            name="secondaryRoles"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <>
                                    <FieldLegend variant="label">Secondary Roles</FieldLegend>
                                    <Show when={organization.settings.modules.i3.enabled}>
                                        <Field orientation="horizontal">
                                            <Checkbox
                                                id="secondary-role-i3-editor"
                                                checked={field.value.includes("i3-editor")}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        field.onChange([
                                                            ...field.value,
                                                            "i3-editor",
                                                        ]);
                                                    } else {
                                                        field.onChange(
                                                            field.value.filter(
                                                                (role) => role !== "i3-editor",
                                                            ),
                                                        );
                                                    }
                                                }}
                                            />
                                            <FieldContent>
                                                <FieldLabel htmlFor="secondary-role-i3-editor">
                                                    {
                                                        OrganizationRole.roles["i3-editor"]
                                                            .displayName
                                                    }
                                                </FieldLabel>
                                                <FieldDescription>
                                                    {
                                                        OrganizationRole.roles["i3-editor"]
                                                            .description
                                                    }
                                                </FieldDescription>
                                            </FieldContent>
                                        </Field>
                                    </Show>
                                    <Show
                                        when={organization.settings.modules["skill-track"].enabled}
                                    >
                                        <Field orientation="horizontal">
                                            <Checkbox
                                                id="secondary-role-skills-assessor"
                                                checked={field.value.includes("skills-assessor")}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        field.onChange([
                                                            ...field.value,
                                                            "skills-assessor",
                                                        ]);
                                                    } else {
                                                        field.onChange(
                                                            field.value.filter(
                                                                (role) =>
                                                                    role !== "skills-assessor",
                                                            ),
                                                        );
                                                    }
                                                }}
                                            />
                                            <FieldContent>
                                                <FieldLabel htmlFor="secondary-role-skills-assessor">
                                                    {
                                                        OrganizationRole.roles["skills-assessor"]
                                                            .displayName
                                                    }
                                                </FieldLabel>
                                                <FieldDescription>
                                                    {
                                                        OrganizationRole.roles["skills-assessor"]
                                                            .description
                                                    }
                                                </FieldDescription>
                                            </FieldContent>
                                        </Field>
                                    </Show>
                                    <Show
                                        when={organization.settings.modules["skill-track"].enabled}
                                    >
                                        <Field orientation="horizontal">
                                            <Checkbox
                                                id="secondary-role-skill-package-author"
                                                checked={field.value.includes(
                                                    "skill-package-author",
                                                )}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        field.onChange([
                                                            ...field.value,
                                                            "skill-package-author",
                                                        ]);
                                                    } else {
                                                        field.onChange(
                                                            field.value.filter(
                                                                (role) =>
                                                                    role !== "skill-package-author",
                                                            ),
                                                        );
                                                    }
                                                }}
                                            />
                                            <FieldContent>
                                                <FieldLabel htmlFor="secondary-role-skill-package-author">
                                                    {
                                                        OrganizationRole.roles[
                                                            "skill-package-author"
                                                        ].displayName
                                                    }
                                                </FieldLabel>
                                                <FieldDescription>
                                                    {
                                                        OrganizationRole.roles[
                                                            "skill-package-author"
                                                        ].description
                                                    }
                                                </FieldDescription>
                                            </FieldContent>
                                        </Field>
                                    </Show>
                                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                                </>
                            )}
                        />
                    </FieldGroup>
                </form>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="update-user-form"
                        status={mutation.status}
                        text={{
                            idle: "Update User",
                            pending: "Updating User",
                            success: "User Updated",
                        }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
