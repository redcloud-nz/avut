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
 * Confirm approving a session as saved. A state-transition confirm, so a plain `Dialog` rather
 * than an `AlertDialog`; host-driven (`open`/`onOpenChange` from the review page, which owns
 * `?action=approve` alongside `?action=reopen`).
 *
 * The page derives `includedCheckIds` and the counts from the checks' saved statuses, and the
 * server approves only if its saved state still matches those ids. If it doesn't (someone recorded
 * or excluded a check meanwhile) the approval fails with `CONFLICT`: the error is shown, the
 * dialog stays open, and the refetch brings in the checks as they are now, for another look.
 */
export function SkillsModule_ApproveSession_Dialog({
    session,
    includedCheckIds,
    excludedCount,
    ...props
}: ComponentProps<typeof Dialog> & {
    session: SkillCheckSession;
    includedCheckIds: SkillCheckId[];
    excludedCount: number;
}) {
    const includedCount = includedCheckIds.length;
    const organization = useOrganization();

    const refetchSessionOnConflict = useRefetchSessionOnConflict(session.id);
    const mutation = useMutation(
        trpc.skillCheckSessions.approveSession.mutationOptions({
            meta: { effects: skillCheckSessionsEffects.approveSession },
            onError(error) {
                console.error("Failed to approve session:", error);
                toast.error(`Failed to approve session: ${error.message}`);
                refetchSessionOnConflict(error);
            },
            onSuccess() {
                toast.success(
                    <>
                        Session <ObjectName>{session.name}</ObjectName> approved.
                    </>,
                );
                props.onOpenChange?.(false);
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
