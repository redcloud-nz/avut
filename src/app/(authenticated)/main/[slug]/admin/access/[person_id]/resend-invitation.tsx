/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

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

export function AdminModule_ResendInvitation_Dialog({
    invitation,
    personName,
    ...props
}: AlertDialogProps & {
    invitation: OrganizationInvitationData;
    personName: string;
}) {
    const organization = useOrganization();

    const mutation = useMutation({
        mutationFn: async () => {
            await authClient.organization.inviteMember({
                organizationId: organization.id,
                email: invitation.email,
                role: invitation.roles,
                resend: true,
            });
        },
        onError(error) {
            console.error("Error resending invitation:", error);
            toast.error("Failed to resend invitation.");
        },
        onSuccess() {
            toast.success(
                <>
                    Invitation resent to <ObjectName>{invitation.email}</ObjectName>.
                </>,
            );
            props.onOpenChange?.(false);
            mutation.reset();
        },
    });

    return (
        <AlertDialog {...props}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Resend Invitation</AlertDialogTitle>
                    <AlertDialogDescription>
                        Resend the invitation email for <ObjectName>{personName}</ObjectName> to{" "}
                        <ObjectName>{invitation.email}</ObjectName>?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        onClick={() => mutation.mutate()}
                        status={mutation.status}
                        text={{
                            idle: "Resend",
                            pending: "Resending",
                            success: "Resent",
                        }}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
