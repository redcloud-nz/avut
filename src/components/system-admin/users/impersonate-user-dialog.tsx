/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
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
import { ObjectName } from "@/components/ui/typography";

import { authQueryKeys } from "@/lib/auth-query-keys";

/**
 * `?action=impersonate` confirm dialog. Host-driven (`open` / `onOpenChange` come from
 * `SystemAdmin_UserActions_Menu`).
 *
 * Impersonation is a Better Auth session action, not an app write — there is no tRPC
 * procedure and no `ctx.logEvent`. On confirm we call `authClient.admin.impersonateUser`
 * directly; on success the operator now holds the target's session, so we drop the stale
 * session cache and navigate to the app root (the normal, non-admin app). Stopping
 * impersonation is handled by the Phase 10 banner.
 */
export function SystemAdmin_ImpersonateUser_Dialog({
    user,
    ...props
}: DialogProps & {
    user: { id: string; name: string };
}) {
    const router = useRouter();
    const queryClient = useQueryClient();

    const mutation = useMutation({
        mutationFn: async () => {
            const { error } = await authClient.admin.impersonateUser({ userId: user.id });
            if (error) throw new Error(error.message ?? "Impersonation failed");
        },
        onError(error: unknown) {
            console.error("Failed to impersonate user:", error);
            const message = error instanceof Error ? error.message : "Unknown error";
            toast.error(`Failed to impersonate user: ${message}`);
        },
        async onSuccess() {
            // Navigate away only — no param clear / mutation.reset() race (see
            // docs/patterns/mutation-dialog.md).
            await queryClient.invalidateQueries({ queryKey: authQueryKeys.all });
            router.push("/");
        },
    });

    useEffect(() => {
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    return (
        <Dialog {...props}>
            <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Impersonate user</DialogTitle>
                    <DialogDescription>
                        You will be signed in as <ObjectName>{user.name}</ObjectName> and see the
                        app exactly as they do, until you stop impersonating. Your admin session is
                        restored when you stop.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={{
                            idle: "Impersonate",
                            pending: "Starting",
                            success: "Impersonating",
                        }}
                        onClick={() => mutation.mutate()}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
