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
import { route } from "@/lib/routes";
import { OrganizationUser } from "@/lib/schemas/organization-user";
import { trpc } from "@/trpc/client";

export function AdminModule_DeleteUser_Dialog({
    user,
    onDeleteSuccess,
    ...props
}: AlertDialogProps & {
    user: OrganizationUser;
    onDeleteSuccess?: () => void;
}) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const mutation = useMutation(
        trpc.accessControl.removeOrganizationUser.mutationOptions({
            onError(error) {
                console.error("Failed to remove user from organization:", error);
                toast.error(`Failed to remove user from organization: ${error.message}`);
            },
            async onSuccess() {
                toast.success(
                    <>
                        User <ObjectName>{user.name}</ObjectName> removed from organisation.
                    </>,
                );
                props.onOpenChange?.(false);

                if (onDeleteSuccess) {
                    onDeleteSuccess();
                } else {
                    router.push(route("/main/[slug]/admin/users", { slug: organization.slug }));
                }

                await queryClient.invalidateQueries(
                    trpc.accessControl.listOrganizationUsers.queryFilter({
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
                        Confirm removal of user <ObjectName>{user.name}</ObjectName> from
                        organisation.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                userId: user.userId,
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
