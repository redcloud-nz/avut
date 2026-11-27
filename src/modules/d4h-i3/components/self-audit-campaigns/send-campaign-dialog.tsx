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
import { SELF_AUDIT_TOKEN_DAYS, type SelfAuditCampaignId } from "@/lib/schemas/self-audit";
import { trpc } from "@/trpc/client";

import { D4HI3Module_SelfAuditCampaign_NoD4H } from "./campaign-d4h-gate";
import { describeSendOutcome } from "./campaign-labels";

type SendCampaign = {
    id: SelfAuditCampaignId;
    name: string;
    /** How many members are waiting to be sent their link. */
    unsentCount: number;
};

/**
 * `?action=send`: confirm sending a Draft, then report how many emails went. Each member waiting
 * to be sent gets their own link; their name and email are read fresh from D4H first. Host-driven:
 * the campaign's page owns the param and keeps this mounted through the send (the campaign stops
 * being a Draft as it succeeds).
 */
export function D4HI3Module_SendSelfAuditCampaign_Dialog({
    campaign,
    ...props
}: ComponentProps<typeof Dialog> & { campaign: SendCampaign }) {
    const logger = useLogger("I3", "SendSelfAuditCampaign");
    const organization = useOrganization();
    const returnFocus = useReturnFocus();

    const mutation = useMutation(
        trpc.selfAuditCampaigns.sendCampaign.mutationOptions({
            meta: { effects: selfAuditCampaignsEffects.sendCampaign },
            onError(error) {
                logger.error("Failed to send self audit campaign", error);
                // No token: the dialog says so in place of the confirm.
                if (trpcErrorCode(error) !== "PRECONDITION_FAILED") {
                    toast.error(`Failed to send campaign: ${error.message}`);
                }
            },
            onSuccess({ sent, failed, noEmail }) {
                const outcome = describeSendOutcome({ sent, failed, noEmail });
                if (failed > 0 || noEmail > 0) {
                    toast.warning(
                        <>
                            Sent <ObjectName>{campaign.name}</ObjectName>: {outcome}.
                        </>,
                    );
                } else {
                    toast.success(
                        <>
                            Sent <ObjectName>{campaign.name}</ObjectName>: {outcome}.
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
    }, [props.open]);

    const noToken = mutation.isError && trpcErrorCode(mutation.error) === "PRECONDITION_FAILED";
    const members = `${campaign.unsentCount} member${campaign.unsentCount === 1 ? "" : "s"}`;

    return (
        <Dialog {...props}>
            <DialogContent {...returnFocus}>
                <DialogHeader>
                    <DialogTitle>Send campaign</DialogTitle>
                    <DialogDescription>
                        Email {members} of <ObjectName>{campaign.name}</ObjectName> their own link.
                    </DialogDescription>
                </DialogHeader>
                {noToken ? (
                    <D4HI3Module_SelfAuditCampaign_NoD4H />
                ) : (
                    <>
                        <DialogBody className="flex flex-col gap-2 text-sm">
                            <p>
                                Each member&rsquo;s name and email are read fresh from D4H first;
                                anyone without an email there is skipped. Links last{" "}
                                {SELF_AUDIT_TOKEN_DAYS} days.
                            </p>
                            <p>
                                Once it&rsquo;s sent the campaign is no longer a Draft: members you
                                add later are emailed straight away, and members can be withdrawn
                                but not removed.
                            </p>
                        </DialogBody>
                        <DialogFooter>
                            <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                            <MutationButton
                                type="button"
                                status={mutation.status}
                                disabled={campaign.unsentCount === 0}
                                text={{
                                    idle: `Send to ${campaign.unsentCount}`,
                                    pending: "Sending",
                                    success: "Sent",
                                }}
                                onClick={() =>
                                    mutation.mutate({
                                        organizationId: organization.id,
                                        campaignId: campaign.id,
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
