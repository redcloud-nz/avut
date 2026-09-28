/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { organizationsEffects } from "@/client/organizations-effects";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogProps,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MutationButton } from "@/components/ui/button";
import { ObjectName } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";
import { type AuthOrganizationMember } from "@/server/auth";
import { trpc } from "@/trpc/client";

/**
 * `?action=remove-owner` confirm dialog on the org-admin Users page — strips ownership from a
 * member, keeping any other roles they hold. The menu item that opens this is always visible
 * (not `<Protect>`-gated); `member: ["owner"]`, the last-owner guard, and the self-removal block
 * are all enforced by the mutation itself, and a caller who fails one of them sees the error
 * surface inside this dialog.
 */
export function AdminModule_RemoveOwner_Dialog({
    organizationUser,
    ...props
}: AlertDialogProps & { organizationUser: AuthOrganizationMember }) {
    const organization = useOrganization();

    const mutation = useMutation(
        trpc.organizations.removeOwner.mutationOptions({
            meta: { effects: organizationsEffects.removeOwner },
            onError(error) {
                console.error("Failed to remove owner status:", error);
                toast.error(`Failed to remove owner status: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Owner status removed from{" "}
                        <ObjectName>{organizationUser.user.name}</ObjectName>.
                    </>,
                );
                props.onOpenChange?.(false);
            },
        }),
    );

    return (
        <AlertDialog {...props}>
            <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remove Owner</AlertDialogTitle>
                    <AlertDialogDescription>
                        Remove ownership of <ObjectName>{organization.name}</ObjectName> from{" "}
                        <ObjectName>{organizationUser.user.name}</ObjectName>. Their other roles are
                        unaffected.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                userId: organizationUser.userId,
                            })
                        }
                        status={mutation.status}
                        text={{
                            idle: "Remove Owner",
                            pending: "Removing Owner",
                            success: "Removed",
                        }}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
