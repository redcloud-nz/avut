/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { organizationsEffects } from "@/client/organizations-effects";
import {
    invitationRolesSchema,
    RoleFields,
} from "@/components/admin/invitations/invitation-role-fields";
import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { ObjectName } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { type AuthOrganizationMember } from "@/server/auth";
import { trpc } from "@/trpc/client";

export function AdminModule_UpdateUser_Dialog({
    organizationUser,
}: {
    organizationUser: AuthOrganizationMember;
}) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["update"] as const));
    const dialogOpen = action === "update";

    // `owner` sits outside this schema (granted and revoked separately) — parsing the stored
    // role drops it, so this dialog only ever edits the non-owner roles.
    const roleDefaults = { roles: OrganizationRole.parseStored(organizationUser.role) };

    const form = useForm({
        resolver: zodResolver(invitationRolesSchema),
        defaultValues: roleDefaults,
    });

    const mutation = useMutation(
        trpc.organizations.setOrganizationMemberRole.mutationOptions({
            meta: { effects: organizationsEffects.setOrganizationMemberRole },
            onError(error) {
                console.error("Failed to update user roles:", error);
                toast.error(`Failed to update user roles: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        User <ObjectName>{organizationUser.user.name}</ObjectName> roles updated.
                    </>,
                );

                handleOpenChange(false);
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        void setAction(open ? "update" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset(roleDefaults);
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const moduleGatedRoles = OrganizationRole.moduleGatedOptions(
        (id) => organization.settings.modules[id].enabled,
    );

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
                <DialogBody>
                    <FormProvider {...form}>
                        <form
                            id="update-user-form"
                            onSubmit={form.handleSubmit(
                                (data) => {
                                    mutation.mutate({
                                        organizationId: organization.id,
                                        userId: organizationUser.userId,
                                        roles: data.roles,
                                    });
                                },
                                (errors) => {
                                    console.error("Form validation errors:", errors);
                                },
                            )}
                        >
                            <FieldGroup>
                                <RoleFields moduleGatedRoles={moduleGatedRoles} />
                            </FieldGroup>
                        </form>
                    </FormProvider>
                </DialogBody>
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
