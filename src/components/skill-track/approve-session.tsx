/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps, useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { skillCheckSessionsEffects } from "@/client/skill-check-sessions-effects";
import { useRefetchSessionOnConflict } from "@/components/skill-track/use-refetch-session-on-conflict";
import { MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ObjectName } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";
import { SkillCheckId } from "@/lib/schemas/skill-check";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

/**
 * Confirm approving a session with the review page's selection. A state-transition confirm, so a
 * plain `Dialog` rather than an `AlertDialog`; host-driven (`open`/`onOpenChange` from the review
 * page, which owns `?action=approve` alongside `?action=reopen`).
 *
 * The page keeps showing its selection while an approval is in flight and until checks fetched
 * after it arrive: `onApproving` gets the submit time just before the mutation starts, and
 * `onApproveSettled` reports how it ended. The mutation's cache effects (which write `getSession`
 * as approved and await the `listSkillChecks` refetch) run before its `onSuccess`/`onSettled`, so
 * the page can't wait for success to start showing its selection.
 *
 * The dialog stays open while its approval is pending (the page doesn't treat the session turning
 * approved as a stale `?action=approve` meanwhile), and closes itself on success.
 */
export function SkillsModule_ApproveSession_Dialog({
    session,
    includedCheckIds,
    includedCount,
    excludedCount,
    onApproving,
    onApproveSettled,
    ...props
}: ComponentProps<typeof Dialog> & {
    session: SkillCheckSession;
    includedCheckIds: SkillCheckId[];
    includedCount: number;
    excludedCount: number;
    onApproving?: (submittedAt: number) => void;
    onApproveSettled?: (ok: boolean) => void;
}) {
    const organization = useOrganization();

    const refetchSessionOnConflict = useRefetchSessionOnConflict(session.id);
    const mutation = useMutation(
        trpc.skillCheckSessions.approveSession.mutationOptions({
            meta: { effects: skillCheckSessionsEffects.approveSession },
            onError(error) {
                console.error("Failed to approve session:", error);
                toast.error(`Failed to approve session: ${error.message}`);
                refetchSessionOnConflict(error);
                onApproveSettled?.(false);
            },
            onSuccess() {
                toast.success(
                    <>
                        Session <ObjectName>{session.name}</ObjectName> approved.
                    </>,
                );
                props.onOpenChange?.(false);
                onApproveSettled?.(true);
            },
        }),
    );

    useEffect(() => {
        // The dialog stays mounted between opens (and across approve → reopen); clear any prior
        // error/success state so the button doesn't open reading "Approved".
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    function handleApprove() {
        onApproving?.(Date.now());
        mutation.mutate({
            organizationId: organization.id,
            sessionId: session.id,
            includedCheckIds,
        });
    }

    return (
        <Dialog {...props}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Approve session</DialogTitle>
                    <DialogDescription>
                        Approve {includedCount} {includedCount === 1 ? "check" : "checks"}, exclude{" "}
                        {excludedCount}. The session will be locked until it&apos;s reopened.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={{
                            idle: "Approve",
                            pending: "Approving",
                            success: "Approved",
                        }}
                        onClick={handleApprove}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
