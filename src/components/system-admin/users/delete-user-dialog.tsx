/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

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

import { systemAdminEffects } from "@/client/system-admin-effects";
import { UserId } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

/**
 * `?action=delete` type-to-confirm dialog for hard-deleting a user account. Host-driven
 * (`open` / `onOpenChange` come from `SystemAdmin_UserActions_Menu`). The destructive button
 * stays disabled until the operator types the user's exact email address.
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

    const mutation = useMutation(
        trpc.systemAdmin.deleteUser.mutationOptions({
            meta: { effects: systemAdminEffects.deleteUser },
            onError(error) {
                console.error("Failed to delete user:", error);
                toast.error(`Failed to delete user: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        User <ObjectName>{user.name}</ObjectName> deleted.
                    </>,
                );
                router.push("/system-admin/users");
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
                        Permanently delete <ObjectName>{user.name}</ObjectName> along with their
                        sessions, credentials, organization memberships, authored notes, and
                        audit-log entries. This cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
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
                        disabled={confirmText !== user.email}
                        text={{ idle: "Delete user", pending: "Deleting", success: "Deleted" }}
                        onClick={() => mutation.mutate({ userId: UserId.schema.parse(user.id) })}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
