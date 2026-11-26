/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { KitCheck_Summary } from "@/components/kit-check/kit-check-summary";
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
import type { KitCheckProgress, KitCheckRequestId } from "@/lib/schemas/kit-check";
import { trpc } from "@/trpc/client";

type AnswersRequest = {
    id: KitCheckRequestId;
    memberName: string;
    d4hTeamTitle: string;
    progress: KitCheckProgress;
};

/**
 * `?action=view-answers&requestId=…`: what one member answered, as the equipment officer reads
 * it. Shows the last submitted answers (kept while a reopened form is edited), or, with nothing
 * submitted yet, the current draft under a "Not submitted yet" note. Host-driven: the kit check's
 * page owns both params and resolves the request.
 */
export function D4HI3Module_KitCheckAnswers_Dialog({
    request,
    ...props
}: ComponentProps<typeof Dialog> & { request: AnswersRequest }) {
    const returnFocus = useReturnFocus();

    return (
        <Dialog {...props}>
            <DialogContent size="xl" {...returnFocus}>
                <DialogHeader>
                    <DialogTitle>{request.memberName}</DialogTitle>
                    <DialogDescription>Kit check answers, {request.d4hTeamTitle}</DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <KitCheckAnswers_Body requestId={request.id} progress={request.progress} />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function KitCheckAnswers_Body({
    requestId,
    progress,
}: {
    requestId: KitCheckRequestId;
    progress: KitCheckProgress;
}) {
    const organization = useOrganization();

    const { data: answers } = useSuspenseQuery(
        trpc.kitChecks.getKitCheckAnswers.queryOptions({
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
                            {progress === "NotOpened"
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
                <KitCheck_Summary
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
