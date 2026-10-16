/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useMutation, useQuery } from "@tanstack/react-query";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, MutationButton } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signOutUrl } from "@/lib/auth-redirect";
import { USER_RETENTION_DAYS } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

/**
 * `?action=close-account` — self-service account closure (#150). Type-your-email to confirm,
 * like the system-admin delete. On success every session is already revoked server-side, so it
 * signs out and clears the query cache.
 *
 * Closing as an organisation's only owner is allowed, but leaves it with no owner, so the dialog
 * lists those organisations first.
 */
export function UserSettings_CloseAccount_Dialog({ email }: { email: string }) {
    const router = useRouter();
    const [confirmText, setConfirmText] = useState("");

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["close-account"] as const),
    );
    const dialogOpen = action === "close-account";

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "close-account" : null, { history: open ? "push" : "replace" });
    }

    const soleOwned = useQuery({
        ...trpc.user.listSoleOwnedOrganizations.queryOptions(),
        enabled: dialogOpen,
    });

    const mutation = useMutation(
        trpc.user.closeMyAccount.mutationOptions({
            onError(error) {
                toast.error(`Couldn't close your account: ${error.message}`);
            },
            async onSuccess() {
                toast.success("Your account has been closed.");
                // The session is already gone server-side; the sign-out page clears the cookie
                // and every cached query.
                router.replace(signOutUrl());
            },
        }),
    );

    useEffect(() => {
        if (dialogOpen) {
            setConfirmText("");
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    return (
        <AlertDialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                    Close account
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Close Account</AlertDialogTitle>
                    <AlertDialogDescription>
                        You&rsquo;ll be signed out everywhere and lose access to your organisations.
                        Your account is permanently deleted after {USER_RETENTION_DAYS} days; until
                        then you can sign in again to restore it. Person records your organisations
                        keep about you are theirs and aren&rsquo;t removed.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {soleOwned.data && soleOwned.data.length > 0 && (
                    <Alert variant="warning">
                        <AlertTitle>These organisations will have no owner</AlertTitle>
                        <AlertDescription>
                            You&rsquo;re the only owner of{" "}
                            {soleOwned.data.map((o) => o.name).join(", ")}. Nobody in them will be
                            able to manage their owners until a system administrator appoints a new
                            one.
                        </AlertDescription>
                    </Alert>
                )}
                <Field>
                    <FieldLabel htmlFor="close-account-confirm">
                        Type <span className="font-mono">{email}</span> to confirm
                    </FieldLabel>
                    <Input
                        id="close-account-confirm"
                        autoComplete="off"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                    />
                </Field>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        disabled={
                            soleOwned.isPending ||
                            confirmText.trim().toLowerCase() !== email.toLowerCase()
                        }
                        text={{ idle: "Close account", pending: "Closing", success: "Closed" }}
                        onClick={() => mutation.mutate({ confirmEmail: confirmText })}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
