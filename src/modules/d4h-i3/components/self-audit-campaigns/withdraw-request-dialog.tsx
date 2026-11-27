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
import type { SelfAuditRequestId } from "@/lib/schemas/self-audit";
import { trpc } from "@/trpc/client";

/**
 * `?action=withdraw&requestId=…`: withdraw a member from a sent campaign. Their link stops working
 * at once; their request and any answers are kept, shown as Withdrawn, and they can be re-added.
 * Host-driven: the campaign's page owns both params, resolves the request, and keeps this mounted
 * through the withdraw (the member stops being withdrawable as it succeeds). A state-transition
 * confirm, so a plain `Dialog` (re-adding undoes it), with a destructive button since the link dies.
 */
export function D4HI3Module_WithdrawSelfAuditRequest_Dialog({
    request,
    ...props
}: ComponentProps<typeof Dialog> & {
    request: { id: SelfAuditRequestId; memberName: string };
}) {
    const logger = useLogger("I3", "WithdrawSelfAuditRequest");
    const organization = useOrganization();
    const returnFocus = useReturnFocus();

    const mutation = useMutation(
        trpc.selfAuditCampaigns.withdrawRequest.mutationOptions({
            meta: { effects: selfAuditCampaignsEffects.withdrawRequest },
            onError(error) {
                logger.error("Failed to withdraw self-audit member", error);
                toast.error(`Failed to withdraw member: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        <ObjectName>{request.memberName}</ObjectName> withdrawn.
                    </>,
                );
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
                    <DialogTitle>Withdraw member</DialogTitle>
                    <DialogDescription>
                        Withdraw <ObjectName>{request.memberName}</ObjectName> from this campaign.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody className="text-sm">
                    <p>
                        The link they were emailed stops working at once. Anything they&rsquo;ve
                        answered is kept, and you can re-add them later with a fresh link.
                    </p>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{ idle: "Withdraw", pending: "Withdrawing", success: "Withdrawn" }}
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
