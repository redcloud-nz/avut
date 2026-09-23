/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ObjectName } from "@/components/ui/typography";
import { useActionHotkeys } from "@/hooks/use-action-hotkeys";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";

import {
    InvitationRoleFields,
    invitationRoles,
    invitationRolesSchema,
} from "./invitation-role-fields";

export function AdminModule_CreateInvitation_Dialog() {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["create"] as const));
    const open = action === "create";

    const canCreateInvitation = useHasPermission({ invitation: ["create"] });
    useActionHotkeys([
        {
            verb: "create",
            run: () => void setAction("create", { history: "push" }),
            enabled: canCreateInvitation,
            name: "New invitation",
            category: "Invitations",
        },
    ]);

    const form = useForm({
        resolver: zodResolver(
            invitationRolesSchema.extend({
                email: z.email("Please enter a valid email address"),
            }),
        ),
        defaultValues: {
            email: "",
            primaryRole: "member",
            secondaryRoles: [],
        } as const,
    });

    const mutation = useMutation({
        mutationFn: async (data: { email: string; roles: OrganizationRole[] }) => {
            return await authClient.organization.inviteMember(
                {
                    email: data.email,
                    role: data.roles,
                    organizationId: organization.id,
                    resend: false,
                },
                { throw: true },
            );
        },
        onError(error) {
            toast.error(`Failed to send invitation: ${error.message}`);
            console.error("Failed to send invitation:", error);
        },
        onSuccess(invitation) {
            toast.success(`Invitation sent to ${invitation.email}`);

            queryClient.invalidateQueries({
                queryKey: ["auth", "organization-invitations", organization.id],
            });

            handleOpenChange(false);
        },
    });

    function handleOpenChange(open: boolean) {
        void setAction(open ? "create" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (open) {
            form.reset();
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <ObjectIcons.Create /> <span className="hidden md:inline">New Invitation</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invite</DialogTitle>
                    <DialogDescription>
                        Invite a new user to the organisation{" "}
                        <ObjectName>{organization.name}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <FormProvider {...form}>
                        <form
                            id="create-invitation-form"
                            onSubmit={form.handleSubmit(
                                (data) =>
                                    mutation.mutate({
                                        email: data.email,
                                        roles: invitationRoles(data),
                                    }),
                                (errors) => {
                                    console.error("Form validation errors:", errors);
                                },
                            )}
                        >
                            <FieldGroup>
                                <Controller
                                    name="email"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="invitation-email">
                                                Email
                                            </FieldLabel>
                                            <Input
                                                id="invitation-email"
                                                autoFocus
                                                autoComplete="off"
                                                aria-invalid={fieldState.invalid}
                                                {...field}
                                            />
                                            {fieldState.error && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                                <InvitationRoleFields />
                            </FieldGroup>
                        </form>
                    </FormProvider>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="create-invitation-form"
                        status={mutation.status}
                        text={{
                            idle: "Send Invitation",
                            pending: "Sending Invitation",
                            success: "Invitation Sent",
                        }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
