/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
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
import { route } from "@/lib/routes";
import { type AuthOrganizationMember } from "@/server/auth";
import { trpc } from "@/trpc/client";

export function AdminModule_DeleteUser_Dialog({
    organizationUser,
    ...props
}: AlertDialogProps & {
    organizationUser: AuthOrganizationMember;
    onSuccess?: () => void;
}) {
    const organization = useOrganization();
    const router = useRouter();

    const mutation = useMutation(
        trpc.organizations.removeOrganizationMember.mutationOptions({
            meta: { effects: organizationsEffects.removeOrganizationMember, navigates: true },
            onError(error) {
                console.error("Failed to remove user from organization:", error);
                toast.error(`Failed to remove user from organization: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        User <ObjectName>{organizationUser.user.name}</ObjectName> removed from
                        organisation.
                    </>,
                );
                // Navigate away. The user detail page holds an active useSuspenseQuery on the
                // member list — see `navigates: true` above, which marks it stale without
                // awaiting a refetch, so the redirect doesn't wait on refetching a now-removed
                // member ("user not found" before the navigation runs).
                router.push(route("/orgs/[slug]/admin/users", { slug: organization.slug }));
            },
        }),
    );

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
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                userId: organizationUser.userId,
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
