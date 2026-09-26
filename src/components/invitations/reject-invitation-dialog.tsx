/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { userEffects } from "@/client/user-effects";
import { MutationButton } from "@/components/ui/button";
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
import { ObjectName } from "@/components/ui/typography";
import { useLogger } from "@/hooks/use-logger";
import type { InvitationId } from "@/lib/schemas/organization-invitation";
import { trpc } from "@/trpc/client";

/**
 * Confirms before declining an organisation invitation. Shared by the invitation landing page
 * and the user dashboard's invitations card, which both call `user.rejectInvitation`.
 */
export function RejectInvitation_Dialog({
    invitation,
    ...props
}: DialogProps & {
    invitation: { id: InvitationId; organizationName: string };
}) {
    const logger = useLogger("Common", "RejectInvitation_Dialog");

    const mutation = useMutation(
        trpc.user.rejectInvitation.mutationOptions({
            meta: { effects: userEffects.rejectInvitation },
            onError(error) {
                logger.error("Failed to decline invitation", error);
                toast.error(`Failed to decline invitation: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Declined invitation to{" "}
                        <ObjectName>{invitation.organizationName}</ObjectName>
                    </>,
                );
                props.onOpenChange?.(false);
            },
        }),
    );

    useEffect(() => {
        if (props.open) {
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Decline invitation</DialogTitle>
                    <DialogDescription>
                        Decline the invitation to join{" "}
                        <ObjectName>{invitation.organizationName}</ObjectName>? You&apos;ll need to
                        ask them for a new invitation if you change your mind.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{ idle: "Decline", pending: "Declining...", success: "Declined" }}
                        onClick={() => mutation.mutate({ invitationId: invitation.id })}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
