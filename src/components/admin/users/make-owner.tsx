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
 * `?action=make-owner` confirm dialog on the org-admin Users page — grants a member ownership
 * in addition to whatever other roles they hold. The menu item that opens this is always
 * visible (not `<Protect>`-gated); `member: ["owner"]` is enforced by the mutation itself, and
 * a caller lacking it sees the error surface inside this dialog.
 */
export function AdminModule_MakeOwner_Dialog({
    organizationUser,
    ...props
}: AlertDialogProps & { organizationUser: AuthOrganizationMember }) {
    const organization = useOrganization();

    const mutation = useMutation(
        trpc.organizations.makeOwner.mutationOptions({
            meta: { effects: organizationsEffects.makeOwner },
            onError(error) {
                console.error("Failed to make user an owner:", error);
                toast.error(`Failed to make user an owner: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        User <ObjectName>{organizationUser.user.name}</ObjectName> is now an owner.
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
                    <AlertDialogTitle>Make Owner</AlertDialogTitle>
                    <AlertDialogDescription>
                        Grant <ObjectName>{organizationUser.user.name}</ObjectName> ownership of{" "}
                        <ObjectName>{organization.name}</ObjectName>, in addition to their other
                        roles. Owners can manage every aspect of the organisation, including
                        deleting it.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                userId: organizationUser.userId,
                            })
                        }
                        status={mutation.status}
                        text={{
                            idle: "Make Owner",
                            pending: "Making Owner",
                            success: "Made Owner",
                        }}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
