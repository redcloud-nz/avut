/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { ComponentProps, useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { organizationGroupsEffects } from "@/client/organization-groups-effects";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MutationButton } from "@/components/ui/button";
import { ObjectName } from "@/components/ui/typography";
import { OrganizationGroupId } from "@/lib/schemas/organization-group";
import { trpc } from "@/trpc/client";

/**
 * `?action=delete` confirm dialog for hard-deleting a group. Host-driven (`open` /
 * `onOpenChange` come from `SystemAdmin_Group_Content`). The service refuses while any membership
 * is active; that conflict shows inside the dialog.
 */
export function SystemAdmin_DeleteGroup_Dialog({
    group,
    ...props
}: ComponentProps<typeof AlertDialog> & { group: { id: OrganizationGroupId; name: string } }) {
    const router = useRouter();

    const mutation = useMutation(
        trpc.organizationGroups.deleteGroup.mutationOptions({
            meta: { effects: organizationGroupsEffects.deleteGroup, navigates: true },
            onError(error) {
                console.error("Failed to delete group:", error);
                if (error.data?.code !== "CONFLICT") {
                    toast.error(`Failed to delete group: ${error.message}`);
                }
            },
            onSuccess() {
                toast.success(
                    <>
                        Group <ObjectName>{group.name}</ObjectName> deleted.
                    </>,
                );
                // Navigation is the whole close: don't also clear the param or reset the mutation.
                router.push("/system/admin/groups");
            },
        }),
    );

    useEffect(() => {
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    return (
        <AlertDialog {...props}>
            <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Group</AlertDialogTitle>
                    <AlertDialogDescription>
                        Delete the group <ObjectName>{group.name}</ObjectName>? This can&rsquo;t be
                        undone. A group can only be deleted once all of its members have been
                        revoked.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {mutation.error?.data?.code === "CONFLICT" && (
                    <Alert variant="destructive">
                        <AlertDescription>{mutation.error.message}</AlertDescription>
                    </Alert>
                )}
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{ idle: "Delete", pending: "Deleting", success: "Deleted" }}
                        onClick={() => mutation.mutate({ groupId: group.id })}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
