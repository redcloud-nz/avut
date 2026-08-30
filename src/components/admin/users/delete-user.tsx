/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
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
import { route } from "@/lib/routes";
import { AuthOrganizationMember } from "@/server/auth";

export function AdminModule_DeleteUser_Dialog({
    organizationUser,
    ...props
}: AlertDialogProps & {
    organizationUser: AuthOrganizationMember;
    onSuccess?: () => void;
}) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const mutation = useMutation({
        async mutationFn() {
            await authClient.organization.removeMember(
                { organizationId: organization.id, memberIdOrEmail: organizationUser.id },
                { throw: true },
            );
        },
        onError(error) {
            console.error("Failed to remove user from organization:", error);
            toast.error(`Failed to remove user from organization: ${error.message}`);
        },
        async onSuccess() {
            toast.success(
                <>
                    User <ObjectName>{organizationUser.user.name}</ObjectName> removed from
                    organisation.
                </>,
            );
            await queryClient.invalidateQueries({
                queryKey: ["auth", "organization-users", organization.id],
            });

            router.push(route("/orgs/[slug]/admin/users", { slug: organization.slug }));
        },
    });

    return (
        <AlertDialog {...props}>
            <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm removal of user{" "}
                        <ObjectName>{organizationUser.user.name}</ObjectName> from organisation{" "}
                        <ObjectName>{organization.name}</ObjectName>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        onClick={() => mutation.mutate()}
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
