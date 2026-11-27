/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

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
import type { SelfAuditRequestId } from "@/lib/schemas/self-audit";
import { trpc } from "@/trpc/client";

/**
 * `?action=remove&requestId=…`: take a member off a Draft, deleting their request. Nobody has been
 * emailed yet. Host-driven: the campaign's page owns both params, resolves the request, and only
 * offers this on a Draft.
 */
export function D4HI3Module_RemoveSelfAuditRequest_Dialog({
    request,
    ...props
}: ComponentProps<typeof AlertDialog> & {
    request: { id: SelfAuditRequestId; memberName: string };
}) {
    const logger = useLogger("I3", "RemoveSelfAuditRequest");
    const organization = useOrganization();
    const returnFocus = useReturnFocus();

    const mutation = useMutation(
        trpc.selfAuditCampaigns.removeRequest.mutationOptions({
            meta: { effects: selfAuditCampaignsEffects.removeRequest },
            onError(error) {
                logger.error("Failed to remove self-audit member", error);
                toast.error(`Failed to remove member: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        <ObjectName>{request.memberName}</ObjectName> removed.
                    </>,
                );
                props.onOpenChange?.(false);
            },
        }),
    );

    useEffect(() => {
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open, request.id]);

    return (
        <AlertDialog {...props}>
            <AlertDialogContent {...returnFocus}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remove member</AlertDialogTitle>
                    <AlertDialogDescription>
                        Take <ObjectName>{request.memberName}</ObjectName> off this Draft. They
                        haven&rsquo;t been emailed, and you can add them again before sending.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{ idle: "Remove", pending: "Removing", success: "Removed" }}
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                requestId: request.id,
                            })
                        }
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
