/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps, useId, useState } from "react";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { selfAuditCampaignsEffects } from "@/client/self-audit-campaigns-effects";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, MutationButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { DialogBoundary } from "@/components/ui/dialog-boundary";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ObjectName } from "@/components/ui/typography";
import { useLogger } from "@/hooks/use-logger";
import { useOrganization } from "@/hooks/use-organization";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { SELF_AUDIT_RECIPIENTS_MAX, type SelfAuditCampaignId } from "@/lib/schemas/self-audit";
import { trpc } from "@/trpc/client";

import { D4HI3Module_SelfAuditCampaign_D4HGate } from "./campaign-d4h-gate";
import { describeSendOutcome } from "./campaign-labels";

type AddMembersCampaign = {
    id: SelfAuditCampaignId;
    d4hTeamName: string;
    sentAt: Date | null;
    requests: readonly { withdrawnAt: Date | null }[];
};

/**
 * `?action=add-members`: pick members of the campaign's D4H team to add, or withdrawn ones to
 * re-add. On a Draft every addable member starts ticked and nobody is emailed until the send; on a
 * sent campaign nobody starts ticked and those added are emailed at once. Host-driven: the
 * campaign's page owns the param. The list reads D4H with the caller's personal token, so without
 * one the dialog says where to add it.
 */
export function D4HI3Module_AddSelfAuditMembers_Dialog({
    campaign,
    ...props
}: ComponentProps<typeof Dialog> & { campaign: AddMembersCampaign }) {
    const returnFocus = useReturnFocus();

    return (
        <Dialog {...props}>
            <DialogContent {...returnFocus}>
                <DialogHeader>
                    <DialogTitle>Add members</DialogTitle>
                    <DialogDescription>
                        Members of <ObjectName>{campaign.d4hTeamName}</ObjectName> in D4H who
                        aren&rsquo;t in this campaign, or were withdrawn from it.
                    </DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <D4HI3Module_SelfAuditCampaign_D4HGate>
                        <AddMembers_Body
                            campaign={campaign}
                            onDone={() => props.onOpenChange?.(false)}
                        />
                    </D4HI3Module_SelfAuditCampaign_D4HGate>
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function AddMembers_Body({
    campaign,
    onDone,
}: {
    campaign: AddMembersCampaign;
    onDone: () => void;
}) {
    const logger = useLogger("I3", "AddSelfAuditMembers");
    const organization = useOrganization();
    const idPrefix = useId();

    const isDraft = campaign.sentAt === null;

    const { data: members } = useSuspenseQuery(
        trpc.selfAuditCampaigns.listAddableMembers.queryOptions({
            organizationId: organization.id,
            campaignId: campaign.id,
        }),
    );
    const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));

    // `SELF_AUDIT_RECIPIENTS_MAX` counts the members not withdrawn, as the service does.
    const memberCount = campaign.requests.filter((request) => request.withdrawnAt === null).length;
    const room = Math.max(0, SELF_AUDIT_RECIPIENTS_MAX - memberCount);

    const [selected, setSelected] = useState<ReadonlySet<number>>(
        () =>
            new Set(
                isDraft ? sortedMembers.slice(0, room).map((member) => member.d4hMemberId) : [],
            ),
    );
    const overCap = selected.size > room;

    function handleCheckedChange(d4hMemberId: number, checked: boolean) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (checked) next.add(d4hMemberId);
            else next.delete(d4hMemberId);
            return next;
        });
    }

    const allSelected = members.length > 0 && selected.size === members.length;

    const mutation = useMutation(
        trpc.selfAuditCampaigns.addMembers.mutationOptions({
            meta: { effects: selfAuditCampaignsEffects.addMembers },
            onError(error) {
                logger.error("Failed to add self-audit members", error);
                toast.error(`Failed to add members: ${error.message}`);
            },
            onSuccess({ added, sent, failed, noEmail }) {
                const members = `${added} member${added === 1 ? "" : "s"}`;
                if (isDraft) {
                    toast.success(
                        noEmail > 0
                            ? `Added ${members}. ${noEmail} ha${noEmail === 1 ? "s" : "ve"} no email in D4H.`
                            : `Added ${members}.`,
                    );
                } else {
                    const outcome = describeSendOutcome({ sent, failed, noEmail });
                    if (failed > 0 || noEmail > 0) toast.warning(`Added ${members}: ${outcome}.`);
                    else toast.success(`Added ${members}: ${outcome}.`);
                }
                onDone();
            },
        }),
    );

    function handleAdd() {
        const d4hMemberIds = [...selected];
        logger.log("Adding self-audit members", { campaignId: campaign.id, d4hMemberIds });
        mutation.mutate({
            organizationId: organization.id,
            campaignId: campaign.id,
            d4hMemberIds,
        });
    }

    if (members.length === 0) {
        return (
            <>
                <DialogBody className="text-sm">
                    <p>
                        Everyone in <ObjectName>{campaign.d4hTeamName}</ObjectName> is already in
                        this campaign.
                    </p>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Close</DialogCloseButton>
                </DialogFooter>
            </>
        );
    }

    return (
        <>
            <DialogBody className="flex flex-col gap-4">
                {!isDraft && (
                    <Alert variant="info">
                        <AlertDescription>
                            This campaign has been sent, so the members you add are emailed their
                            link straight away.
                        </AlertDescription>
                    </Alert>
                )}
                <div className="flex items-center justify-between gap-2 border-b pb-1 text-sm">
                    <span className="text-muted-foreground">
                        {selected.size} of {members.length} selected
                    </span>
                    <Button
                        type="button"
                        variant="link"
                        size="xs"
                        onClick={() =>
                            setSelected(
                                new Set(
                                    allSelected ? [] : members.map((member) => member.d4hMemberId),
                                ),
                            )
                        }
                    >
                        {allSelected ? "Select none" : "Select all"}
                    </Button>
                </div>
                <FieldGroup className="gap-3">
                    {sortedMembers.map((member) => {
                        const fieldId = `${idPrefix}-member-${member.d4hMemberId}`;
                        return (
                            <Field orientation="horizontal" key={member.d4hMemberId}>
                                <Checkbox
                                    id={fieldId}
                                    checked={selected.has(member.d4hMemberId)}
                                    onCheckedChange={(checked) =>
                                        handleCheckedChange(member.d4hMemberId, checked === true)
                                    }
                                />
                                <FieldLabel htmlFor={fieldId} className="flex-wrap font-normal">
                                    <span className="font-medium">{member.name}</span>
                                    {member.withdrawnRequestId && (
                                        <Badge variant="outline">Re-add</Badge>
                                    )}
                                    {member.email === null && (
                                        <Badge variant="warning-outline">No email</Badge>
                                    )}
                                </FieldLabel>
                            </Field>
                        );
                    })}
                </FieldGroup>
                {overCap && (
                    <Alert variant="warning">
                        <AlertDescription>
                            A campaign can have at most {SELF_AUDIT_RECIPIENTS_MAX} members. It has{" "}
                            {memberCount}, so select at most {room}.
                        </AlertDescription>
                    </Alert>
                )}
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    type="button"
                    status={mutation.status}
                    disabled={selected.size === 0 || overCap}
                    text={{
                        idle: selected.size > 0 ? `Add ${selected.size}` : "Add",
                        pending: isDraft ? "Adding" : "Adding and sending",
                        success: "Added",
                    }}
                    onClick={handleAdd}
                />
            </DialogFooter>
        </>
    );
}
