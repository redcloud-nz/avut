/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

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
import { ObjectName } from "@/components/ui/typography";

import { systemAdminEffects } from "@/client/system-admin-effects";
import { UserId } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

/**
 * `?action=promote` / `?action=demote` state-transition confirm dialog for a user's global
 * role. Host-driven (`open` / `onOpenChange` come from `SystemAdmin_UserActions_Menu`), which
 * also picks `action` from the current `user.role`.
 *
 * Plain `Dialog` (not `AlertDialog` — that is reserved for delete/remove). `onSuccess` stays
 * on the page and only closes the dialog (via `onOpenChange`), letting `meta.effects` refresh
 * the user caches.
 */
export function SystemAdmin_SetUserRole_Dialog({
    user,
    action,
    ...props
}: DialogProps & {
    user: { id: string; name: string };
    action: "promote" | "demote";
}) {
    const promote = action === "promote";

    const mutation = useMutation(
        trpc.systemAdmin.setUserRole.mutationOptions({
            meta: { effects: systemAdminEffects.setUserRole },
            onError(error) {
                console.error("Failed to change user role:", error);
                toast.error(`Failed to change role: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        User <ObjectName>{user.name}</ObjectName>{" "}
                        {promote ? "promoted to admin" : "demoted to user"}.
                    </>,
                );
                props.onOpenChange?.(false);
            },
        }),
    );

    useEffect(() => {
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open, action]);

    return (
        <Dialog {...props}>
            <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>{promote ? "Promote to admin" : "Demote to user"}</DialogTitle>
                    <DialogDescription>
                        {promote ? (
                            <>
                                Grant <ObjectName>{user.name}</ObjectName> the global{" "}
                                <span className="font-mono">admin</span> role — full access to
                                system administration for the whole site.
                            </>
                        ) : (
                            <>
                                Remove the global <span className="font-mono">admin</span> role from{" "}
                                <ObjectName>{user.name}</ObjectName>. They keep their organization
                                memberships and roles.
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={
                            promote
                                ? { idle: "Promote", pending: "Promoting", success: "Promoted" }
                                : { idle: "Demote", pending: "Demoting", success: "Demoted" }
                        }
                        onClick={() =>
                            mutation.mutate({
                                userId: UserId.schema.parse(user.id),
                                role: promote ? "admin" : "user",
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
