/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { MutationButton } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ObjectName } from "@/components/ui/typography";

import { UserId } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

/**
 * `?action=ban` / `?action=unban` state-transition confirm dialog for a user account.
 * Host-driven (`open` / `onOpenChange` come from `SystemAdmin_UserActions_Menu`, which also
 * picks `action` from the current `user.banned`).
 *
 * Ban/unban is a Better Auth session action, not an app write — there is no tRPC procedure and
 * no `ctx.logEvent`. We call `authClient.admin.banUser` / `unbanUser` directly so Better Auth
 * revokes the banned user's sessions server-side. Because these aren't tRPC mutations,
 * `meta.effects` doesn't apply — `onSuccess` invalidates the `systemAdmin` user queries
 * explicitly (mirroring `src/components/admin/users/users-list.tsx`). The ban is permanent
 * (no `banExpiresIn`). `onSuccess` stays on the page and only closes the dialog.
 */
export function SystemAdmin_BanUser_Dialog({
    user,
    action,
    ...props
}: DialogProps & {
    user: { id: string; name: string };
    action: "ban" | "unban";
}) {
    const ban = action === "ban";
    const queryClient = useQueryClient();
    const [reason, setReason] = useState("");

    const mutation = useMutation({
        mutationFn: async () => {
            const trimmed = reason.trim();
            const { error } = ban
                ? await authClient.admin.banUser({
                      userId: user.id,
                      ...(trimmed ? { banReason: trimmed } : {}),
                  })
                : await authClient.admin.unbanUser({ userId: user.id });
            if (error) throw new Error(error.message ?? (ban ? "Ban failed" : "Unban failed"));
        },
        onError(error: unknown) {
            console.error(`Failed to ${action} user:`, error);
            const message = error instanceof Error ? error.message : "Unknown error";
            toast.error(`Failed to ${action} user: ${message}`);
        },
        async onSuccess() {
            toast.success(
                <>
                    User <ObjectName>{user.name}</ObjectName> {ban ? "banned" : "unbanned"}.
                </>,
            );
            await Promise.all([
                queryClient.invalidateQueries(trpc.systemAdmin.listUsers.queryFilter()),
                queryClient.invalidateQueries(
                    trpc.systemAdmin.getUser.queryFilter({ userId: UserId.schema.parse(user.id) }),
                ),
            ]);
            props.onOpenChange?.(false);
        },
    });

    useEffect(() => {
        if (props.open) {
            setReason("");
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open, action]);

    return (
        <Dialog {...props}>
            <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>{ban ? "Ban user" : "Unban user"}</DialogTitle>
                    <DialogDescription>
                        {ban ? (
                            <>
                                Ban <ObjectName>{user.name}</ObjectName>. Their active sessions are
                                revoked immediately and they cannot sign in until unbanned.
                            </>
                        ) : (
                            <>
                                Lift the ban on <ObjectName>{user.name}</ObjectName>. They will be
                                able to sign in again.
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>
                {ban && (
                    <Field>
                        <FieldLabel htmlFor="ban-user-reason">Reason</FieldLabel>
                        <Textarea
                            id="ban-user-reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                        <FieldDescription>Optional. Stored on the user record.</FieldDescription>
                    </Field>
                )}
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        variant={ban ? "destructive" : "default"}
                        status={mutation.status}
                        text={
                            ban
                                ? { idle: "Ban user", pending: "Banning", success: "Banned" }
                                : { idle: "Unban user", pending: "Unbanning", success: "Unbanned" }
                        }
                        onClick={() => mutation.mutate()}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
