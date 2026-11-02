/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { ComponentProps, type RefObject } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { d4hAccessTokensEffects } from "@/client/d4h-access-tokens-effects";
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
import { useOrganization } from "@/hooks/use-organization";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { route } from "@/lib/routes";
import { ProviderCredentialId } from "@/lib/schemas/provider-credential";
import { trpc } from "@/trpc/client";

export function AdminModule_DeleteD4HAccessToken_Dialog({
    token,
    returnFocusRef,
    ...props
}: ComponentProps<typeof AlertDialog> & {
    token: { id: ProviderCredentialId; label: string };
    /** Where focus goes on close when the control that opened the dialog is gone (a menu item). */
    returnFocusRef?: RefObject<HTMLElement | null>;
}) {
    const organization = useOrganization();
    const returnFocus = useReturnFocus(returnFocusRef);
    const router = useRouter();

    const mutation = useMutation(
        trpc.d4hAccessTokens.deleteOrganizationAccessToken.mutationOptions({
            meta: {
                effects: d4hAccessTokensEffects.deleteOrganizationAccessToken,
                navigates: true,
            },
            onError(error) {
                toast.error(`Failed to delete D4H access token: ${error.message}`);
            },
            onSuccess() {
                toast.success("D4H access token deleted");
                router.push(
                    route("/orgs/[slug]/admin/d4h-access-tokens", { slug: organization.slug }),
                );
            },
        }),
    );

    return (
        <AlertDialog {...props}>
            <AlertDialogContent {...returnFocus}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete D4H Access Token</AlertDialogTitle>
                    <AlertDialogDescription>
                        Confirm deletion of <ObjectName>{token.label || token.id}</ObjectName>. The
                        token is removed from AVUT but not revoked in D4H. D4H Attendance Reminders
                        stops until another token is chosen. This cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{ idle: "Delete", pending: "Deleting", success: "Deleted" }}
                        onClick={() =>
                            mutation.mutate({ organizationId: organization.id, tokenId: token.id })
                        }
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
