/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { SelfAudit_Summary } from "@/components/self-audit/self-audit-summary";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

type AnswersRequest = {
    id: SelfAuditRequestId;
    memberName: string;
    status: SelfAuditStatus;
};

/** The statuses of a request whose form hasn't been opened. */
const NOT_OPENED: readonly SelfAuditStatus[] = ["Unsent", "Sent", "Failed", "NoEmail"];

/**
 * `?action=view-answers&requestId=…`: what one member answered, as the equipment officer reads
 * it. Shows the last submitted answers (kept while a reopened form is edited), or, with nothing
 * submitted yet, the current draft under a "Not submitted yet" note. Host-driven: the self audit campaign's
 * page owns both params and resolves the request.
 */
export function D4HI3Module_SelfAuditCampaignAnswers_Dialog({
    request,
    ...props
}: ComponentProps<typeof Dialog> & { request: AnswersRequest }) {
    const returnFocus = useReturnFocus();

    return (
        <Dialog {...props}>
            <DialogContent size="xl" {...returnFocus}>
                <DialogHeader>
                    <DialogTitle>{request.memberName}</DialogTitle>
                    <DialogDescription>Self-audit answers</DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <SelfAuditAnswers_Body requestId={request.id} status={request.status} />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function SelfAuditAnswers_Body({
    requestId,
    status,
}: {
    requestId: SelfAuditRequestId;
    status: SelfAuditStatus;
}) {
    const organization = useOrganization();

    const { data: answers } = useSuspenseQuery(
        trpc.selfAuditCampaigns.getRequestAnswers.queryOptions({
            organizationId: organization.id,
            requestId,
        }),
    );

    const submitted = answers.submittedData;
    // Reopened: the member is changing answers they'd already submitted.
    const editing = submitted !== null && answers.formStatus !== "Submitted";

    return (
        <>
            <DialogBody className="gap-4">
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
