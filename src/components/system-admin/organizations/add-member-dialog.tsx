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
import { useMutation, useQuery } from "@tanstack/react-query";

import {
    invitationRoles,
    invitationRolesSchema,
    RoleFields,
    type InvitationRolesFormValues,
    type SecondaryRoleOptions,
} from "@/components/admin/invitations/invitation-role-fields";
import { CreateNewIcon } from "@/components/icons";
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
import { SearchableSelect } from "@/components/ui/searchable-select";

import { systemAdminEffects } from "@/client/system-admin-effects";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

const addMemberFormSchema = z.object({
    userId: UserId.schema,
    ...invitationRolesSchema.shape,
});

function defaultRoles(): InvitationRolesFormValues {
    return { primaryRole: "member", secondaryRoles: [] };
}

/**
 * `?action=add-member` dialog for attaching an existing user to an organization as a direct
 * membership from the system-admin organization detail page. Follows
 * `docs/patterns/mutation-dialog.md` (Recipe A — self-triggered, owns its own param).
 */
export function SystemAdmin_AddMember_Dialog({
    organizationId,
    memberUserIds,
    secondaryRoles,
}: {
    organizationId: OrganizationId;
    memberUserIds: string[];
    /** The secondary roles this organization's enabled modules make available. */
    secondaryRoles: SecondaryRoleOptions;
}) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["add-member"] as const),
    );
    const dialogOpen = action === "add-member";

    const usersQuery = useQuery(trpc.systemAdmin.listUsers.queryOptions());

    const existing = new Set(memberUserIds);
    const options = (usersQuery.data?.users ?? [])
        .filter((u) => !existing.has(u.id))
        .map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }));

    const form = useForm({
        resolver: zodResolver(addMemberFormSchema),
        defaultValues: { userId: undefined, ...defaultRoles() },
    });

    const mutation = useMutation(
        trpc.systemAdmin.addOrganizationMember.mutationOptions({
            meta: { effects: systemAdminEffects.addOrganizationMember },
            onError(error) {
                if (error.data?.code === "CONFLICT") {
                    form.setError("userId", { message: error.message });
                } else {
                    console.error("Failed to add member:", error);
                    toast.error(`Failed to add member: ${error.message}`);
                }
            },
            onSuccess() {
                toast.success("Member added.");
                handleOpenChange(false);
            },
        }),
    );

    function handleOpenChange(open: boolean) {
        void setAction(open ? "add-member" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset({ userId: undefined, ...defaultRoles() });
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit(
        (formData) =>
            mutation.mutate({
                organizationId,
                userId: formData.userId,
                roles: invitationRoles(formData),
            }),
        (errors) => console.error("Form validation errors:", errors),
    );

    return (
        <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <CreateNewIcon /> <span className="hidden md:inline">Add Member</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Member</DialogTitle>
                    <DialogDescription>
                        Attach an existing user to this organisation directly, bypassing the
                        invitation flow.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <FormProvider {...form}>
                        <form id="add-member-form" onSubmit={handleSubmit}>
                            <FieldGroup>
                                <Controller
                                    control={form.control}
                                    name="userId"
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel>User</FieldLabel>
                                            <SearchableSelect
                                                value={field.value}
                                                onValueChange={(value) => field.onChange(value)}
                                                options={options}
                                                placeholder="Select a user"
                                                searchPlaceholder="Search users..."
                                                emptyMessage={
                                                    usersQuery.isLoading
                                                        ? "Loading..."
                                                        : "No eligible users."
                                                }
                                                aria-invalid={fieldState.invalid}
                                            />
                                            {fieldState.error && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                                <RoleFields secondaryRoles={secondaryRoles} />
                            </FieldGroup>
                        </form>
                    </FormProvider>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form="add-member-form"
                        status={mutation.status}
                        text={{ idle: "Add", pending: "Adding", success: "Added" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
