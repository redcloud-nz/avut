/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps, useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { selfAuditCampaignsEffects } from "@/client/self-audit-campaigns-effects";
import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ObjectName } from "@/components/ui/typography";
import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { SELF_AUDIT_TOKEN_DAYS, type SelfAuditRequestId } from "@/lib/schemas/self-audit";
import { trpc } from "@/trpc/client";

type ResendRequest = {
    id: SelfAuditRequestId;
    memberName: string;
    email: string | null;
};

/**
 * `?action=resend&requestId=…`: email a member a new link. Their old link stops working; their
 * answers so far are kept. Host-driven: the self audit campaign's page owns both params, resolves the
 * request, and doesn't render this for a member with no email.
 */
export function D4HI3Module_ResendSelfAudit_Dialog({
    request,
    ...props
}: ComponentProps<typeof Dialog> & { request: ResendRequest }) {
    const logger = useLogger("I3", "ResendSelfAuditRequest");
    const organization = useOrganization();
    const returnFocus = useReturnFocus();

    const mutation = useMutation(
        trpc.selfAuditCampaigns.resendRequest.mutationOptions({
            meta: { effects: selfAuditCampaignsEffects.resendRequest },
            onError(error) {
                logger.error("Failed to resend self-audit", error);
                toast.error(`Failed to resend self-audit: ${error.message}`);
            },
            onSuccess({ deliveryStatus }) {
                if (deliveryStatus === "Sent") {
                    toast.success(
                        <>
                            New link sent to <ObjectName>{request.memberName}</ObjectName>.
                        </>,
                    );
                } else {
                    toast.error(
                        <>
                            The email to <ObjectName>{request.memberName}</ObjectName> didn&rsquo;t
                            send. Their old link no longer works; try again.
                        </>,
                    );
                }
                props.onOpenChange?.(false);
            },
        }),
    );

    useEffect(() => {
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open, request.id]);

    return (
        <Dialog {...props}>
            <DialogContent {...returnFocus}>
                <DialogHeader>
                    <DialogTitle>Resend self-audit</DialogTitle>
                    <DialogDescription>
                        Email <ObjectName>{request.memberName}</ObjectName> a new link
                        {request.email ? ` at ${request.email}` : ""}.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody className="text-sm">
                    <p>
                        The link they already have stops working, and the new one lasts{" "}
                        {SELF_AUDIT_TOKEN_DAYS} days. Anything they&rsquo;ve answered so far is
                        kept.
                    </p>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={{ idle: "Resend", pending: "Sending", success: "Sent" }}
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                requestId: request.id,
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
