/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { ComponentProps } from "react";
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
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MutationButton } from "@/components/ui/button";
import { ObjectName } from "@/components/ui/typography";
import { trpc } from "@/trpc/client";
import type { RouterOutput } from "@/trpc/routers/_app";

type Membership = RouterOutput["users"]["listMemberships"][number];

export function UserSettings_LeaveOrganization_Dialog({
    membership,
    ...props
}: ComponentProps<typeof AlertDialog> & { membership: Membership }) {
    const router = useRouter();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async () => {
            await authClient.organization.leave(
                { organizationId: membership.organization.id },
                { throw: true },
            );
        },
        onError(error) {
            toast.error(`Failed to leave organisation: ${error.message}`);
        },
        async onSuccess() {
            await queryClient.invalidateQueries(trpc.users.listMemberships.queryFilter());
            toast.success(
                <>
                    Left <ObjectName>{membership.organization.name}</ObjectName>
                </>,
            );
            router.push("/user/settings/organizations");
        },
    });

    return (
        <AlertDialog {...props}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Leave Organisation</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm leaving <ObjectName>{membership.organization.name}</ObjectName>.
                        You&rsquo;ll need a new invitation to rejoin.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{ idle: "Leave", pending: "Leaving", success: "Left" }}
                        onClick={() => mutation.mutate()}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
