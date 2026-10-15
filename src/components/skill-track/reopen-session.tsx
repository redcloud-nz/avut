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
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

/**
 * Confirm reopening an approved session. A state-transition confirm, so a plain `Dialog`
 * rather than an `AlertDialog`; host-driven (`open`/`onOpenChange` from the session menu,
 * which owns `?action=reopen`) because the success effect hides the menu's Reopen item.
 */
export function SkillsModule_ReopenSession_Dialog({
    session,
    ...props
}: ComponentProps<typeof Dialog> & { session: SkillCheckSession }) {
    const organization = useOrganization();

    const refetchSessionOnConflict = useRefetchSessionOnConflict(session.id);
    const mutation = useMutation(
        trpc.skillCheckSessions.reopenSession.mutationOptions({
            meta: { effects: skillCheckSessionsEffects.reopenSession },
            onError(error) {
                console.error("Failed to reopen session:", error);
                toast.error(`Failed to reopen session: ${error.message}`);
                refetchSessionOnConflict(error);
            },
            onSuccess() {
                toast.success(
                    <>
                        Session <ObjectName>{session.name}</ObjectName> reopened.
                    </>,
                );
                props.onOpenChange?.(false);
            },
        }),
    );

    useEffect(() => {
        // The dialog stays mounted between opens; clear any prior error/success state.
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    return (
        <Dialog {...props}>
            <DialogContent onCloseAutoFocus={(e) => e.preventDefault()}>
                <DialogHeader>
                    <DialogTitle>Reopen session</DialogTitle>
                    <DialogDescription>
                        Reopen session <ObjectName>{session.name}</ObjectName>? It goes back to
                        Draft so its checks can be recorded, changed and reviewed again. Its results
                        leave competency reports until the session is approved again.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={{
                            idle: "Reopen",
                            pending: "Reopening",
                            success: "Reopened",
                        }}
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                skillCheckSessionId: session.id,
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
