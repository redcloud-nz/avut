/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useMutation, useQuery } from "@tanstack/react-query";

import { usersEffects } from "@/client/users-effects";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ObjectName } from "@/components/ui/typography";
import { USER_RETENTION_DAYS, UserId } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

/**
 * `?action=delete` type-to-confirm dialog for deleting a user account into the system Rubbish bin
 * (#296). Host-driven
 * (`open` / `onOpenChange` come from `SystemAdmin_UserActions_Menu`). The destructive button
 * stays disabled until the operator types the user's exact email address. Deleting an
 * organisation's only owner is allowed; the dialog lists those organisations first.
 *
 * `onSuccess` navigates to the users list — per `docs/patterns/mutation-dialog.md`, a delete's
 * success handler does only the navigation (no param clear / `mutation.reset()` race).
 */
export function SystemAdmin_DeleteUser_Dialog({
    user,
    ...props
}: AlertDialogProps & {
    user: { id: string; name: string; email: string };
}) {
    const router = useRouter();
    const [confirmText, setConfirmText] = useState("");

    const soleOwned = useQuery({
        ...trpc.users.listSoleOwnedOrganizations.queryOptions({
            userId: UserId.schema.parse(user.id),
        }),
        enabled: props.open === true,
    });

    const mutation = useMutation(
        trpc.users.deleteUser.mutationOptions({
            meta: { effects: usersEffects.deleteUser, navigates: true },
            onError(error) {
                console.error("Failed to delete user:", error);
                toast.error(`Failed to delete user: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        User <ObjectName>{user.name}</ObjectName> moved to the Rubbish bin.
                    </>,
                );
                router.push("/system/admin/users");
            },
        }),
    );

    useEffect(() => {
        if (props.open) {
            setConfirmText("");
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    return (
        <AlertDialog {...props}>
            <AlertDialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete user</AlertDialogTitle>
                    <AlertDialogDescription>
                        <ObjectName>{user.name}</ObjectName> is signed out everywhere and
                        can&rsquo;t sign in. The account moves to the system Rubbish bin, where it
                        can be recovered for {USER_RETENTION_DAYS} days before it is permanently
                        deleted along with its credentials, memberships, D4H access tokens and
                        notes.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {soleOwned.data && soleOwned.data.length > 0 && (
                    <Alert variant="warning">
                        <AlertTitle>These organisations will have no owner</AlertTitle>
                        <AlertDescription>
                            <ObjectName>{user.name}</ObjectName> is the only owner of{" "}
                            {soleOwned.data.map((o) => o.name).join(", ")}. Appoint a new owner from
                            each organisation&rsquo;s members list afterwards.
                        </AlertDescription>
                    </Alert>
                )}
                <Field>
                    <FieldLabel htmlFor="delete-user-confirm">
                        Type <span className="font-mono">{user.email}</span> to confirm
                    </FieldLabel>
                    <Input
                        id="delete-user-confirm"
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
                        disabled={soleOwned.isPending || confirmText !== user.email}
                        text={{ idle: "Delete user", pending: "Deleting", success: "Deleted" }}
                        onClick={() => mutation.mutate({ userId: UserId.schema.parse(user.id) })}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
