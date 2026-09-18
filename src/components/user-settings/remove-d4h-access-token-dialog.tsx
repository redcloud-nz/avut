/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

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

import { d4hAccessTokensEffects } from "@/client/d4h-access-tokens-effects";
import { trpc } from "@/trpc/client";
import type { RouterOutput } from "@/trpc/routers/_app";

type PersonalAccessToken = RouterOutput["d4hAccessTokens"]["listPersonalAccessTokens"][number];

export function UserSettings_RemoveD4HAccessToken_Dialog({
    token,
    ...props
}: ComponentProps<typeof AlertDialog> & { token: PersonalAccessToken }) {
    const router = useRouter();

    const mutation = useMutation(
        trpc.d4hAccessTokens.deletePersonalAccessToken.mutationOptions({
            meta: { effects: d4hAccessTokensEffects.deletePersonalAccessToken },
            onError(error) {
                toast.error(`Failed to remove D4H access token: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        D4H access token for <ObjectName>{token.organization.name}</ObjectName>{" "}
                        removed.
                    </>,
                );
                router.push("/user/settings/d4h");
            },
        }),
    );

    return (
        <AlertDialog {...props}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remove D4H Access Token</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm removal of the D4H access token for{" "}
                        <ObjectName>{token.organization.name}</ObjectName>. This cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{ idle: "Remove", pending: "Removing", success: "Removed" }}
                        onClick={() => mutation.mutate({ organizationId: token.organization.id })}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
