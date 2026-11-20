/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ComponentProps, useEffect } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { d4hNagEffects } from "@/client/d4h-nag-effects";
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
import { useOrganization } from "@/hooks/use-organization";
import { useReturnFocus } from "@/hooks/use-return-focus";
import type { D4HNagOptOutListItem } from "@/lib/schemas/d4h-nag";
import { trpc } from "@/trpc/client";

/**
 * `?action=remove-opt-out&optOutId=…` confirm dialog for removing an opt-out, so the member gets
 * reminders for the team again. Host-driven: the opt-outs list owns both params and resolves the
 * row. Opened from a row button that isn't a `DialogTrigger`, so `useReturnFocus` returns focus.
 */
export function D4HNag_RemoveOptOut_Dialog({
    optOut,
    ...props
}: ComponentProps<typeof AlertDialog> & {
    optOut: Pick<D4HNagOptOutListItem, "id" | "team" | "memberName">;
}) {
    const organization = useOrganization();
    const returnFocus = useReturnFocus();

    const mutation = useMutation(
        trpc.d4hNag.removeOptOut.mutationOptions({
            meta: { effects: d4hNagEffects.removeOptOut },
            onError(error) {
                console.error("Failed to remove opt-out:", error);
                toast.error(`Failed to remove opt-out: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        <ObjectName>{optOut.memberName}</ObjectName> will get reminders for{" "}
                        <ObjectName>{optOut.team.name}</ObjectName> again.
                    </>,
                );
                props.onOpenChange?.(false);
            },
        }),
    );

    useEffect(() => {
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open, optOut.id]);

    return (
        <AlertDialog {...props}>
            <AlertDialogContent {...returnFocus}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Remove Opt-out</AlertDialogTitle>
                    <AlertDialogDescription>
                        <ObjectName>{optOut.memberName}</ObjectName> will get attendance reminders
                        for <ObjectName>{optOut.team.name}</ObjectName> again, unless they&apos;ve
                        also opted out on another team linked to the same D4H team.
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
                                optOutId: optOut.id,
                            })
                        }
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
