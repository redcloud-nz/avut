/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { organizationsEffects } from "@/client/organizations-effects";
import {
    invitationRoles,
    memberRolesSchema,
    RoleFields,
    type InvitationRolesFormValues,
} from "@/components/admin/invitations/invitation-role-fields";
import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ObjectName } from "@/components/ui/typography";
import { hasOwnerRole } from "@/lib/permissions";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationRole, type ModuleGatedRoleOptions } from "@/lib/schemas/organization-role";
import { trpc } from "@/trpc/client";

interface Member {
    userId: string;
    name: string;
    email: string;
    /** Comma-joined role set, as stored on the membership. */
    role: string;
}

/**
 * The role form's values for a stored role set — see `OrganizationRole.formDefaults`, which
 * drops `owner` (granted and revoked separately) and any role another held role already covers.
 */
function roleFormValues(stored: string): InvitationRolesFormValues {
    return { roles: OrganizationRole.formDefaults(stored) };
}

/**
 * Per-row actions for an organization member on the system-admin detail page:
 * "Change role" (`?action=set-member-role`), "Make owner" (`?action=make-owner`, for a
 * non-owner) and "Remove" (`?action=remove-member`, destructive). The dialogs are driven by the
 * shared `action` param plus a `memberUserId` param naming the row.
 *
 * "Make owner" is how an organization left with no owner gets one back. Removing the last owner
 * is allowed, with a warning.
 */
export function SystemAdmin_MemberActionsMenu({
    organizationId,
    member,
    isLastOwner,
    moduleGatedRoles,
}: {
    organizationId: OrganizationId;
    member: Member;
    /** This member is the organization's only owner, so removing them leaves it with none. */
    isLastOwner: boolean;
    /** The module-gated roles, each marked with whether this organization can offer it. */
    moduleGatedRoles: ModuleGatedRoleOptions;
}) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["set-member-role", "make-owner", "remove-member"] as const),
    );
    const [memberUserId, setMemberUserId] = useQueryState("memberUserId", parseAsString);

    const isTarget = memberUserId === member.userId;
    const roleDialogOpen = isTarget && action === "set-member-role";
    const removeDialogOpen = isTarget && action === "remove-member";
    const makeOwnerDialogOpen = isTarget && action === "make-owner";
    const isOwner = hasOwnerRole(member.role);

    const roleForm = useForm({
        resolver: zodResolver(memberRolesSchema(isOwner)),
        defaultValues: roleFormValues(member.role),
    });

    function open(next: "set-member-role" | "make-owner" | "remove-member") {
        void setMemberUserId(member.userId, { history: "push" });
        void setAction(next, { history: "push" });
    }
    function close() {
        void setAction(null, { history: "replace" });
        void setMemberUserId(null, { history: "replace" });
    }

    const setRoleMutation = useMutation(
        trpc.organizations.setOrganizationMemberRole.mutationOptions({
            meta: { effects: organizationsEffects.setOrganizationMemberRole },
            onError(error) {
                console.error("Failed to change member role:", error);
                toast.error(`Failed to change role: ${error.message}`);
            },
            onSuccess() {
                toast.success("Member role updated.");
                close();
            },
        }),
    );

    const makeOwnerMutation = useMutation(
        trpc.organizations.makeOwner.mutationOptions({
            meta: { effects: organizationsEffects.makeOwner },
            onError(error) {
                console.error("Failed to make member an owner:", error);
                toast.error(`Failed to make owner: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        <ObjectName>{member.name}</ObjectName> is now an owner.
                    </>,
                );
                close();
            },
        }),
    );

    const removeMutation = useMutation(
        trpc.organizations.removeOrganizationMember.mutationOptions({
            meta: { effects: organizationsEffects.removeOrganizationMember },
            onError(error) {
                console.error("Failed to remove member:", error);
                toast.error(`Failed to remove member: ${error.message}`);
            },
            onSuccess() {
                toast.success("Member removed.");
                close();
            },
        }),
    );

    useEffect(() => {
        if (roleDialogOpen) {
            roleForm.reset(roleFormValues(member.role));
            setRoleMutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [roleDialogOpen]);

    useEffect(() => {
        if (makeOwnerDialogOpen) makeOwnerMutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [makeOwnerDialogOpen]);

    useEffect(() => {
        if (removeDialogOpen) removeMutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [removeDialogOpen]);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-44" align="end">
                    <DropdownMenuItem onSelect={() => open("set-member-role")}>
                        <ObjectIcons.Edit /> Change role
                    </DropdownMenuItem>
                    {!isOwner && (
                        <DropdownMenuItem onSelect={() => open("make-owner")}>
                            <ObjectIcons.Edit /> Make owner
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem variant="destructive" onSelect={() => open("remove-member")}>
                        <ObjectIcons.Delete /> Remove
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={roleDialogOpen} onOpenChange={(open) => (open ? undefined : close())}>
                <DialogContent size="lg" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Change role</DialogTitle>
                        <DialogDescription>
                            Change the organisation roles for <ObjectName>{member.name}</ObjectName>
                            .
                        </DialogDescription>
                    </DialogHeader>
                    <DialogBody>
                        <FormProvider {...roleForm}>
                            <RoleFields moduleGatedRoles={moduleGatedRoles} isOwner={isOwner} />
                        </FormProvider>
                    </DialogBody>
                    <DialogFooter>
                        <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                        <MutationButton
                            type="button"
                            status={setRoleMutation.status}
                            disabled={!roleForm.formState.isDirty}
                            text={{ idle: "Save", pending: "Saving", success: "Saved" }}
                            onClick={roleForm.handleSubmit(
                                (values) =>
                                    setRoleMutation.mutate({
                                        organizationId,
                                        userId: member.userId,
                                        roles: invitationRoles(values),
                                    }),
                                (errors) => console.error("Form validation errors:", errors),
                            )}
                        />
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={makeOwnerDialogOpen}
                onOpenChange={(open) => (open ? undefined : close())}
            >
                <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Make owner</AlertDialogTitle>
                        <AlertDialogDescription>
                            Make <ObjectName>{member.name}</ObjectName> ({member.email}) an owner of
                            this organisation, in addition to their current roles.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <MutationButton
                            type="button"
                            status={makeOwnerMutation.status}
                            text={{ idle: "Make owner", pending: "Saving", success: "Saved" }}
                            onClick={() =>
                                makeOwnerMutation.mutate({ organizationId, userId: member.userId })
                            }
                        />
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={removeDialogOpen}
                onOpenChange={(open) => (open ? undefined : close())}
            >
                <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove member</AlertDialogTitle>
                        <AlertDialogDescription>
                            Remove <ObjectName>{member.name}</ObjectName> ({member.email}) from this
                            organisation. This does not delete the user account.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {isLastOwner && (
                        <Alert variant="warning">
                            <AlertTitle>This is the only owner</AlertTitle>
                            <AlertDescription>
                                The organisation will have no owner. Make another member an owner
                                afterwards so someone can manage its owners.
                            </AlertDescription>
                        </Alert>
                    )}
                    <AlertDialogFooter>
                        <MutationButton
                            type="button"
                            variant="destructive"
                            status={removeMutation.status}
                            text={{ idle: "Remove", pending: "Removing", success: "Removed" }}
                            onClick={() =>
                                removeMutation.mutate({ organizationId, userId: member.userId })
                            }
                        />
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
