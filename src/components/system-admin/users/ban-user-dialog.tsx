/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { systemAdminEffects } from "@/client/system-admin-effects";
import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ObjectName } from "@/components/ui/typography";
import type { UserId } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

/**
 * `?action=ban` / `?action=unban` state-transition confirm dialog for a user account.
 * Host-driven (`open` / `onOpenChange` come from `SystemAdmin_UserActions_Menu`, which also
 * picks `action` from the current `user.banned`).
 *
 * Routes through `systemAdmin.banUser`/`unbanUser`, which enforce the self-ban guard
 * server-side (#86) and log a `Ban`/`Unban` entry on the target's own timeline. The ban is
 * permanent (no `banExpiresIn`).
 */
export function SystemAdmin_BanUser_Dialog({
    user,
    action,
    ...props
}: DialogProps & {
    user: { id: UserId; name: string };
    action: "ban" | "unban";
}) {
    const ban = action === "ban";
    const [reason, setReason] = useState("");

    function onError(error: { message: string }) {
        console.error(`Failed to ${action} user:`, error);
        toast.error(`Failed to ${action} user: ${error.message}`);
    }

    function onSuccess() {
        toast.success(
            <>
                User <ObjectName>{user.name}</ObjectName> {ban ? "banned" : "unbanned"}.
            </>,
        );
        props.onOpenChange?.(false);
    }

    const banMutation = useMutation(
        trpc.systemAdmin.banUser.mutationOptions({
            meta: { effects: systemAdminEffects.banUser },
            onError,
            onSuccess,
        }),
    );
    const unbanMutation = useMutation(
        trpc.systemAdmin.unbanUser.mutationOptions({
            meta: { effects: systemAdminEffects.unbanUser },
            onError,
            onSuccess,
        }),
    );
    const mutation = ban ? banMutation : unbanMutation;

    useEffect(() => {
        if (props.open) {
            setReason("");
            banMutation.reset();
            unbanMutation.reset();
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
                <DialogBody>
                    {ban && (
                        <Field>
                            <FieldLabel htmlFor="ban-user-reason">Reason</FieldLabel>
                            <Textarea
                                id="ban-user-reason"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                            <FieldDescription>
                                Optional. Stored on the user record.
                            </FieldDescription>
                        </Field>
                    )}
                </DialogBody>
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
                        onClick={() => {
                            const trimmed = reason.trim();
                            if (ban) {
                                banMutation.mutate({
                                    userId: user.id,
                                    ...(trimmed ? { banReason: trimmed } : {}),
                                });
                            } else {
                                unbanMutation.mutate({ userId: user.id });
                            }
                        }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
