/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
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
import { Field, FieldLabel } from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ObjectName } from "@/components/ui/typography";

import { systemAdminEffects } from "@/client/system-admin-effects";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { trpc } from "@/trpc/client";

interface Member {
    userId: string;
    name: string;
    email: string;
    role: string;
}

/**
 * Per-row actions for an organization member on the system-admin detail page:
 * "Change role" (`?action=set-member-role`) and "Remove" (`?action=remove-member`,
 * destructive). Both dialogs are confirm-style and driven by the shared `action` param
 * plus a `memberUserId` param naming the row.
 */
export function SystemAdmin_MemberActionsMenu({
    organizationId,
    member,
}: {
    organizationId: OrganizationId;
    member: Member;
}) {
    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["set-member-role", "remove-member"] as const),
    );
    const [memberUserId, setMemberUserId] = useQueryState("memberUserId", parseAsString);

    const isTarget = memberUserId === member.userId;
    const roleDialogOpen = isTarget && action === "set-member-role";
    const removeDialogOpen = isTarget && action === "remove-member";

    const [role, setRole] = useState(member.role);

    function open(next: "set-member-role" | "remove-member") {
        void setMemberUserId(member.userId, { history: "push" });
        void setAction(next, { history: "push" });
    }
    function close() {
        void setAction(null, { history: "replace" });
        void setMemberUserId(null, { history: "replace" });
    }

    const setRoleMutation = useMutation(
        trpc.systemAdmin.setOrganizationMemberRole.mutationOptions({
            meta: { effects: systemAdminEffects.setOrganizationMemberRole },
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

    const removeMutation = useMutation(
        trpc.systemAdmin.removeOrganizationMember.mutationOptions({
            meta: { effects: systemAdminEffects.removeOrganizationMember },
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
            setRole(member.role);
            setRoleMutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [roleDialogOpen]);

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
                    <DropdownMenuItem variant="destructive" onSelect={() => open("remove-member")}>
                        <ObjectIcons.Delete /> Remove
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={roleDialogOpen} onOpenChange={(open) => (open ? undefined : close())}>
                <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Change role</DialogTitle>
                        <DialogDescription>
                            Change the organization role for <ObjectName>{member.name}</ObjectName>.
                        </DialogDescription>
                    </DialogHeader>
                    <Field>
                        <FieldLabel>Role</FieldLabel>
                        <Select value={role} onValueChange={setRole}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {OrganizationRole.options.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </Field>
                    <DialogFooter>
                        <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                        <MutationButton
                            type="button"
                            status={setRoleMutation.status}
                            disabled={role === member.role}
                            text={{ idle: "Save", pending: "Saving", success: "Saved" }}
                            onClick={() =>
                                setRoleMutation.mutate({
                                    organizationId,
                                    userId: member.userId,
                                    role: OrganizationRole.schema.parse(role),
                                })
                            }
                        />
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={removeDialogOpen}
                onOpenChange={(open) => (open ? undefined : close())}
            >
                <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove member</AlertDialogTitle>
                        <AlertDialogDescription>
                            Remove <ObjectName>{member.name}</ObjectName> ({member.email}) from this
                            organization. This does not delete the user account.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
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
