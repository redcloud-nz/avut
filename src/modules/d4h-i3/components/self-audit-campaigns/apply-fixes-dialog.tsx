/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ComponentProps, useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { selfAuditCampaignsEffects } from "@/client/self-audit-campaigns-effects";
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
import type { SelfAuditRequestId } from "@/lib/schemas/self-audit";
import type { SelfAuditApplyResult, SelfAuditDifference } from "@/lib/self-audit-differences";
import { trpc } from "@/trpc/client";

import { describeFix } from "./campaign-labels";

/**
 * `?action=apply&requestId=…`: confirm applying a member's selected differences from D4H. Each is
 * marked LOST or created in D4H, or queued as a D4H task; the server recomputes the member's
 * differences and skips any key that no longer matches. Host-driven: the differences page owns
 * both params and hands over the differences selected when Apply was pressed, so the list stays
 * as confirmed while the page's differences refetch under it. A state-transition confirm, so a
 * plain `Dialog`.
 *
 * Apply stays disabled while the mutation is pending: two applies racing for one member could
 * create the same item twice (accepted in the plan's review notes). So the dialog can't be closed
 * while it's pending either (Cancel, Escape and an outside click are ignored), and reopening it
 * never resets a mutation in flight; the differences page also disables the member's "Apply
 * selected" until the apply settles.
 */
export function D4HI3Module_ApplySelfAuditFixes_Dialog({
    member,
    differences,
    onApplied,
    ...props
}: ComponentProps<typeof Dialog> & {
    member: { requestId: SelfAuditRequestId; memberName: string };
    /** The selected, selectable differences, keys exactly as `listDifferences` returned them. */
    differences: readonly SelfAuditDifference[];
    /** After the apply settles successfully, before the dialog closes. */
    onApplied: () => void;
}) {
    const logger = useLogger("I3", "ApplySelfAuditFixes");
    const organization = useOrganization();
    const returnFocus = useReturnFocus();

    const mutation = useMutation(
        trpc.selfAuditCampaigns.applyFixes.mutationOptions({
            meta: { effects: selfAuditCampaignsEffects.applyFixes },
            onError(error) {
                logger.error("Failed to apply self-audit fixes", error);
                toast.error(`Failed to apply fixes: ${error.message}`);
            },
            onSuccess(result) {
                showResult(member.memberName, differences, result);
                onApplied();
                props.onOpenChange?.(false);
            },
        }),
    );

    useEffect(() => {
        if (props.open && !mutation.isPending) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open, member.requestId]);

    return (
        <Dialog
            {...props}
            onOpenChange={(open) => {
                if (!open && mutation.isPending) return;
                props.onOpenChange?.(open);
            }}
        >
            <DialogContent {...returnFocus}>
                <DialogHeader>
                    <DialogTitle>Apply fixes</DialogTitle>
                    <DialogDescription>
                        Apply {differences.length === 1 ? "this fix" : "these fixes"} for{" "}
                        <ObjectName>{member.memberName}</ObjectName>.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody className="flex flex-col gap-3 text-sm">
                    <ul className="flex flex-col gap-2">
                        {differences.map((difference) => (
                            <li key={difference.key} className="flex flex-col">
                                <span className="font-medium">{difference.label}</span>
                                <span className="text-muted-foreground">
                                    {difference.fix && describeFix(difference.fix)}
                                </span>
                            </li>
                        ))}
                    </ul>
                    <p className="text-muted-foreground">
                        D4H changes are made at once with your token; queued tasks wait on the D4H
                        Tasks page for someone to apply them in D4H.
                    </p>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline" disabled={mutation.isPending}>
                        Cancel
                    </DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        disabled={differences.length === 0}
                        text={{ idle: "Apply", pending: "Applying", success: "Applied" }}
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                requestId: member.requestId,
                                keys: differences.map((difference) => difference.key),
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * The toast for an apply: what was applied, queued, skipped and failed, with each failure's and
 * each warning's reason. A success toast only when everything went through cleanly.
 */
function showResult(
    memberName: string,
    differences: readonly SelfAuditDifference[],
    { applied, queued, skipped, failed }: SelfAuditApplyResult,
) {
    const summary = [
        applied.length > 0 && `${applied.length} applied`,
        queued.length > 0 && `${queued.length} queued`,
        skipped.length > 0 && `${skipped.length} skipped`,
        failed.length > 0 && `${failed.length} failed`,
    ]
        .filter((part): part is string => typeof part === "string")
        .join(", ");

    const labelOf = (key: string) =>
        differences.find((difference) => difference.key === key)?.label ?? key;
    const problems = [
        ...failed.map((item) => `${item.label}: ${item.error}`),
        ...applied.flatMap((item) => (item.warning ? [`${item.label}: ${item.warning}`] : [])),
        ...skipped.map(
            (item) => `${labelOf(item.key)}: skipped, it changed since the page was loaded`,
        ),
    ];

    const message = `${memberName}: ${summary || "nothing applied"}.`;
    if (problems.length > 0) toast.warning(message, { description: problems.join("\n") });
    else toast.success(message);
}
