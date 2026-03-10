/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";

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
import { OrganizationMembershipData } from "@/lib/schemas/organization-member";
import { UserData } from "@/lib/schemas/user";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

export function AdminModule_DeleteUser_Dialog({
    organizationUser,
    user,
    ...props
}: AlertDialogProps & {
    organizationUser: OrganizationMembershipData;
    user: UserData;
}) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const mutation = useMutation(
        trpc.organizations.removeOrganizationMembership.mutationOptions({
            onError(error) {
                console.error("Failed to delete organisation member:", error);
                toast.error(
                    `Failed to delete organisation member: ${error.message}`,
                );
            },
            async onSuccess() {
                toast.success(
                    <>
                        User <ObjectName>{user.name}</ObjectName> removed from
                        organisation.
                    </>,
                );
                props.onOpenChange?.(false);

                // Redirect to the personnel list page after deletion
                router.push(Paths.main(organization.slug).admin.users.href);

                await queryClient.invalidateQueries(
                    trpc.organizations.listOrganizationMembers.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                mutation.reset();
            },
        }),
    );

    return (
        <AlertDialog {...props}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm removal of user{" "}
                        <ObjectName>{user.name}</ObjectName> from organisation.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                userId: user.id,
                            })
                        }
                        status={mutation.status}
                        text={{
                            idle: "Delete",
                            pending: "Deleting",
                            success: "Deleted",
                        }}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
