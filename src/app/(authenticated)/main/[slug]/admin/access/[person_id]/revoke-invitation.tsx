/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
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
import { OrganizationInvitationData } from "@/lib/schemas/organization-invitation";
import { trpc } from "@/trpc/client";

export function AdminModule_RevokeInvitation_Dialog({
    invitation,
    personName,
    ...props
}: AlertDialogProps & {
    invitation: OrganizationInvitationData;
    personName: string;
}) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async () => {
            await authClient.organization.cancelInvitation({
                invitationId: invitation.id,
            });
        },
        onError(error) {
            console.error("Error revoking invitation:", error);
            toast.error("Failed to revoke invitation.");
        },
        async onSuccess() {
            toast.success(
                <>
                    Invitation for <ObjectName>{invitation.email}</ObjectName> revoked.
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

    return (
        <AlertDialog {...props}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
                    <AlertDialogDescription>
                        Revoke the invitation for <ObjectName>{personName}</ObjectName> (
                        <ObjectName>{invitation.email}</ObjectName>)? They will no longer be able to
                        use the invitation link.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        onClick={() => mutation.mutate()}
                        status={mutation.status}
                        text={{
                            idle: "Revoke",
                            pending: "Revoking",
                            success: "Revoked",
                        }}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
