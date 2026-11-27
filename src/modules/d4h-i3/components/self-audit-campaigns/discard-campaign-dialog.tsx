/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { ComponentProps, useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { selfAuditCampaignsEffects } from "@/client/self-audit-campaigns-effects";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MutationButton } from "@/components/ui/button";
import { ObjectName } from "@/components/ui/typography";
import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { route } from "@/lib/routes";
import type { SelfAuditCampaignId } from "@/lib/schemas/self-audit";
import { trpc } from "@/trpc/client";

/**
 * `?action=discard`: delete a Draft with its members, then go back to the list. Host-driven: the
 * campaign's page owns the param and only offers this on a Draft.
 */
export function D4HI3Module_DiscardSelfAuditCampaign_Dialog({
    campaign,
    ...props
}: ComponentProps<typeof AlertDialog> & {
    campaign: { id: SelfAuditCampaignId; name: string };
}) {
    const logger = useLogger("I3", "DiscardSelfAuditCampaign");
    const organization = useOrganization();
    const router = useRouter();
    const returnFocus = useReturnFocus();

    const mutation = useMutation(
        trpc.selfAuditCampaigns.discardCampaign.mutationOptions({
            meta: { effects: selfAuditCampaignsEffects.discardCampaign, navigates: true },
            onError(error) {
                logger.error("Failed to discard self audit campaign", error);
                toast.error(`Failed to discard draft: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Draft <ObjectName>{campaign.name}</ObjectName> discarded.
                    </>,
                );
                router.push(
                    route("/orgs/[slug]/d4h-i3/self-audit-campaigns", { slug: organization.slug }),
                );
            },
        }),
    );

    useEffect(() => {
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    return (
        <AlertDialog {...props}>
            <AlertDialogContent {...returnFocus}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Discard draft</AlertDialogTitle>
                    <AlertDialogDescription>
                        Delete <ObjectName>{campaign.name}</ObjectName> and its members. Nobody has
                        been emailed yet. This can&rsquo;t be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{ idle: "Discard", pending: "Discarding", success: "Discarded" }}
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                campaignId: campaign.id,
                            })
                        }
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
