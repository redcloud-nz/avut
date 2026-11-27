/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps, useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { selfAuditCampaignsEffects } from "@/client/self-audit-campaigns-effects";
import { trpcErrorCode } from "@/components/errors/describe-error";
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
import {
    SELF_AUDIT_TOKEN_DAYS,
    type SelfAuditCampaignId,
    type SelfAuditRequestId,
} from "@/lib/schemas/self-audit";
import { trpc } from "@/trpc/client";

import { D4HI3Module_SelfAuditCampaign_NoD4H } from "./campaign-d4h-gate";

type ReaddRequest = {
    id: SelfAuditRequestId;
    d4hMemberId: number;
    memberName: string;
};

/**
 * `?action=re-add&requestId=…`: bring a withdrawn member back into a sent campaign. Their name and
 * email are read fresh from D4H, their answers so far are kept, and they're emailed a fresh link.
 * Re-adds through `addMembers` with that one member, which needs the caller's personal D4H token;
 * without one the dialog says where to add it. Host-driven: the campaign's page owns both params,
 * resolves the request, and keeps this mounted through the re-add (the member stops being
 * withdrawn as it succeeds).
 */
export function D4HI3Module_ReaddSelfAuditRequest_Dialog({
    campaignId,
    request,
    ...props
}: ComponentProps<typeof Dialog> & { campaignId: SelfAuditCampaignId; request: ReaddRequest }) {
    const logger = useLogger("I3", "ReaddSelfAuditRequest");
    const organization = useOrganization();
    const returnFocus = useReturnFocus();

    const mutation = useMutation(
        trpc.selfAuditCampaigns.addMembers.mutationOptions({
            meta: { effects: selfAuditCampaignsEffects.addMembers },
            onError(error) {
                logger.error("Failed to re-add self-audit member", error);
                // No token: the dialog says so in place of the confirm.
                if (trpcErrorCode(error) !== "PRECONDITION_FAILED") {
                    toast.error(`Failed to re-add member: ${error.message}`);
                }
            },
            onSuccess({ sent, noEmail }) {
                const name = <ObjectName>{request.memberName}</ObjectName>;
                if (sent > 0) {
                    toast.success(<>{name} re-added and emailed a new link.</>);
                } else if (noEmail > 0) {
                    toast.warning(
                        <>{name} re-added, but they have no email in D4H, so no link was sent.</>,
                    );
                } else {
                    toast.warning(
                        <>
                            {name} re-added, but the email didn&rsquo;t send. Resend it to try
                            again.
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

    const noToken = mutation.isError && trpcErrorCode(mutation.error) === "PRECONDITION_FAILED";

    return (
        <Dialog {...props}>
            <DialogContent {...returnFocus}>
                <DialogHeader>
                    <DialogTitle>Re-add member</DialogTitle>
                    <DialogDescription>
                        Bring <ObjectName>{request.memberName}</ObjectName> back into this campaign
                        and email them a fresh link.
                    </DialogDescription>
                </DialogHeader>
                {noToken ? (
                    <D4HI3Module_SelfAuditCampaign_NoD4H />
                ) : (
                    <>
                        <DialogBody className="text-sm">
                            <p>
                                Their name and email are read fresh from D4H first. Anything
                                they&rsquo;d answered before they were withdrawn is kept, and the
                                new link lasts {SELF_AUDIT_TOKEN_DAYS} days.
                            </p>
                        </DialogBody>
                        <DialogFooter>
                            <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                            <MutationButton
                                type="button"
                                status={mutation.status}
                                text={{ idle: "Re-add", pending: "Re-adding", success: "Re-added" }}
                                onClick={() =>
                                    mutation.mutate({
                                        organizationId: organization.id,
                                        campaignId,
                                        d4hMemberIds: [request.d4hMemberId],
                                    })
                                }
                            />
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
