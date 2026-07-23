/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

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
import { UserId } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

export function AdminModule_UnlinkPerson_Dialog({
    userId,
    userName,
    personName,
    ...props
}: AlertDialogProps & { userId: UserId; userName: string; personName: string }) {
    const organization = useOrganization();
    const queryClient = useQueryClient();

    const mutation = useMutation(
        trpc.accessControl.unlinkPerson.mutationOptions({
            onError(error) {
                console.error("Failed to unlink person:", error);
                toast.error(`Failed to unlink person: ${error.message}`);
            },
            async onSuccess() {
                toast.success(
                    <>
                        Person unlinked from user <ObjectName>{userName}</ObjectName>.
                    </>,
                );

                await Promise.all([
                    queryClient.invalidateQueries({
                        queryKey: ["auth", "organization-users", organization.id],
                    }),
                    queryClient.invalidateQueries(trpc.accessControl.getLinkedPerson.queryFilter()),
                    queryClient.invalidateQueries(trpc.accessControl.listPersonLinks.queryFilter()),
                    queryClient.invalidateQueries(
                        trpc.accessControl.listUnlinkedPersonnel.queryFilter(),
                    ),
                    queryClient.invalidateQueries(trpc.personnel.getLinkedUser.queryFilter()),
                ]);

                props.onOpenChange?.(false);
                mutation.reset();
            },
        }),
    );

    return (
        <AlertDialog {...props}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Unlink Person</AlertDialogTitle>
                    <AlertDialogDescription>
                        Unlink person <ObjectName>{personName}</ObjectName> from user{" "}
                        <ObjectName>{userName}</ObjectName>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        onClick={() => mutation.mutate({ organizationId: organization.id, userId })}
                        status={mutation.status}
                        text={{
                            idle: "Unlink",
                            pending: "Unlinking",
                            success: "Unlinked",
                        }}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
