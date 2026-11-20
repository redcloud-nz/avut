/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
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
import { route } from "@/lib/routes";
import type { D4HNagRuleListItem } from "@/lib/schemas/d4h-nag";
import { trpc } from "@/trpc/client";

/**
 * `?action=delete` confirm dialog for permanently deleting a rule. Host-driven (`open` /
 * `onOpenChange` come from the rule's actions menu). The rule's runs are kept (decision 7).
 *
 * Opened from a menu item rather than a `DialogTrigger`, so `useReturnFocus` returns focus on
 * close.
 */
export function D4HNag_DeleteRule_Dialog({
    rule,
    ...props
}: ComponentProps<typeof AlertDialog> & {
    rule: Pick<D4HNagRuleListItem, "id" | "team" | "schedule">;
}) {
    const organization = useOrganization();
    const router = useRouter();
    const returnFocus = useReturnFocus();

    const mutation = useMutation(
        trpc.d4hNag.deleteRule.mutationOptions({
            meta: { effects: d4hNagEffects.deleteRule, navigates: true },
            onError(error) {
                console.error("Failed to delete rule:", error);
                toast.error(`Failed to delete rule: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Rule for <ObjectName>{rule.team.name}</ObjectName> deleted.
                    </>,
                );
                // Navigation is the whole close: don't also clear the param or reset the mutation.
                router.push(route("/orgs/[slug]/d4h-nag", { slug: organization.slug }));
            },
        }),
    );

    useEffect(() => {
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    return (
        <AlertDialog {...props}>
            <AlertDialogContent {...returnFocus}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Rule</AlertDialogTitle>
                    <AlertDialogDescription>
                        Permanently delete the rule for <ObjectName>{rule.team.name}</ObjectName> (
                        {rule.schedule}). Its run history is kept, shown as runs of a deleted rule.
                        To stop reminders for a while instead, disable the rule.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{ idle: "Delete", pending: "Deleting", success: "Deleted" }}
                        onClick={() =>
                            mutation.mutate({ organizationId: organization.id, ruleId: rule.id })
                        }
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
