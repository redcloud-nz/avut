/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { SelfAudit_Summary } from "@/components/self-audit/self-audit-summary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
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
import { useOrganization } from "@/hooks/use-organization";
import { useReturnFocus } from "@/hooks/use-return-focus";
import type { SelfAuditRequestId, SelfAuditStatus } from "@/lib/schemas/self-audit";
import { trpc } from "@/trpc/client";

import { STATUS_BADGES, STATUS_LABELS } from "./campaign-labels";

type MemberRequest = {
    id: SelfAuditRequestId;
    memberName: string;
    email: string | null;
    status: SelfAuditStatus;
    sentAt: Date | null;
    openedAt: Date | null;
    submittedAt: Date | null;
    withdrawnAt: Date | null;
    expiresAt: Date | null;
};

/** The statuses of a request whose form hasn't been opened. */
const NOT_OPENED: readonly SelfAuditStatus[] = ["Unsent", "Sent", "Failed", "NoEmail"];

/**
 * `?action=view-answers&requestId=…`: one member of a self audit campaign. Their email, status,
 * timeline (sent, opened, submitted, withdrawn) and link expiry, then what they answered, as the
 * equipment officer reads it: the last submitted answers (kept while a reopened form is edited),
 * or, with nothing submitted yet, the current draft under a "Not submitted yet" note.
 * Host-driven: the self audit campaign's page owns both params and resolves the request.
 */
export function D4HI3Module_SelfAuditCampaignMember_Dialog({
    request,
    ...props
}: ComponentProps<typeof Dialog> & { request: MemberRequest }) {
    const returnFocus = useReturnFocus();

    return (
        <Dialog {...props}>
            <DialogContent size="xl" {...returnFocus}>
                <DialogHeader>
                    <DialogTitle>{request.memberName}</DialogTitle>
                    <DialogDescription>Self-audit member</DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <SelfAuditMember_Body request={request} />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function SelfAuditMember_Body({ request }: { request: MemberRequest }) {
    const organization = useOrganization();
    const { status } = request;

    const { data: answers } = useSuspenseQuery(
        trpc.selfAuditCampaigns.getRequestAnswers.queryOptions({
            organizationId: organization.id,
            requestId: request.id,
        }),
    );

    const submitted = answers.submittedData;
    // Reopened: the member is changing answers they'd already submitted.
    const editing = submitted !== null && answers.formStatus !== "Submitted";

    return (
        <>
            <DialogBody className="gap-4">
                <DataList>
                    <DataItem inline>
                        <DataItemTitle>Email</DataItemTitle>
                        <DataItemValue>{request.email ?? "—"}</DataItemValue>
                    </DataItem>
                    <DataItem inline>
                        <DataItemTitle>Status</DataItemTitle>
                        <DataItemValue>
                            <Badge variant={STATUS_BADGES[status]}>{STATUS_LABELS[status]}</Badge>
                        </DataItemValue>
                    </DataItem>
                    <TimelineItem title="Sent" date={request.sentAt} />
                    <TimelineItem title="Opened" date={request.openedAt} />
                    <TimelineItem title="Submitted" date={request.submittedAt} />
                    {request.withdrawnAt && (
                        <TimelineItem title="Withdrawn" date={request.withdrawnAt} />
                    )}
                    <TimelineItem title="Link Expires" date={request.expiresAt} />
                </DataList>
                {submitted === null ? (
                    <Alert variant="info">
                        <AlertTitle>Not submitted yet</AlertTitle>
                        <AlertDescription>
                            {NOT_OPENED.includes(status)
                                ? "They haven't opened it yet; this is the pre-filled form."
                                : "These are their answers so far."}
                        </AlertDescription>
                    </Alert>
                ) : editing ? (
                    <Alert variant="info">
                        <AlertTitle>Being changed</AlertTitle>
                        <AlertDescription>
                            They&rsquo;ve reopened their answers to change them. These are the ones
                            they last submitted.
                        </AlertDescription>
                    </Alert>
                ) : null}
                <SelfAudit_Summary
                    templates={answers.templates}
                    heldItems={answers.heldItems}
                    response={submitted ?? answers.formData}
                    intro={false}
                />
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Close</DialogCloseButton>
            </DialogFooter>
        </>
    );
}

/** One timeline row: the date and how long ago, or "—" while it hasn't happened. */
function TimelineItem({ title, date }: { title: string; date: Date | null }) {
    return (
        <DataItem inline>
            <DataItemTitle>{title}</DataItemTitle>
            {date ? <DataItemDateValue date={date} /> : <DataItemValue>—</DataItemValue>}
        </DataItem>
    );
}
