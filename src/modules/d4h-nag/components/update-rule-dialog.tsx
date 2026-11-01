/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useId } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";

import { d4hNagEffects } from "@/client/d4h-nag-effects";
import { ObjectIcons } from "@/components/icons";
import { Button, MutationButton } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogProps,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ObjectName } from "@/components/ui/typography";
import { useOrganization } from "@/hooks/use-organization";
import { useReturnFocus } from "@/hooks/use-return-focus";
import type { D4HNagRuleListItem } from "@/lib/schemas/d4h-nag";
import { trpc } from "@/trpc/client";

import { D4HNag_RuleFormFields, D4HNagRuleFormSchema } from "./rule-form";

type Rule = Pick<
    D4HNagRuleListItem,
    "id" | "teamId" | "team" | "schedule" | "weekday" | "hour" | "lookAheadHours" | "message"
>;

function formValues(rule: Rule) {
    const { teamId, weekday, hour, lookAheadHours, message } = rule;
    return { teamId, weekday, hour, lookAheadHours, message };
}

/**
 * `?action=update` — self-triggered (Recipe A): the trigger button lives here, and the rule's
 * actions menu can open it too. The rule's team can't change, so the form has no team picker.
 */
export function D4HNag_UpdateRule_Dialog({ rule }: { rule: Rule }) {
    const organization = useOrganization();

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["update"] as const));
    const dialogOpen = action === "update";

    const formId = useId();
    const form = useForm({
        resolver: zodResolver(D4HNagRuleFormSchema),
        defaultValues: formValues(rule),
    });

    const mutation = useMutation(
        trpc.d4hNag.updateRule.mutationOptions({
            meta: { effects: d4hNagEffects.updateRule },
            onError(error) {
                console.error("Failed to update rule", error);
                toast.error(`Failed to update rule: ${error.message}`);
            },
            onSuccess() {
                toast.success("Rule updated");
                handleDialogOpenChange(false);
            },
        }),
    );

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "update" : null, { history: open ? "push" : "replace" });
    }

    useEffect(() => {
        if (dialogOpen) {
            form.reset(formValues(rule));
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [dialogOpen]);

    const handleSubmit = form.handleSubmit(
        ({ teamId: _, ...update }) =>
            mutation.mutate({ organizationId: organization.id, ruleId: rule.id, ...update }),
        (errors) => console.warn("Form validation errors:", errors),
    );

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Edit rule">
                    <ObjectIcons.Edit />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Rule</DialogTitle>
                    <DialogDescription>
                        Reminders for <ObjectName>{rule.team.name}</ObjectName>. A rule&apos;s team
                        can&apos;t be changed.
                    </DialogDescription>
                </DialogHeader>
                <DialogBody>
                    <form id={formId} onSubmit={handleSubmit}>
                        <D4HNag_RuleFormFields control={form.control} />
                    </form>
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="submit"
                        form={formId}
                        status={mutation.status}
                        text={{ idle: "Save", pending: "Saving", success: "Saved" }}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * `?action=enable` / `?action=disable` — a state-transition confirm, host-driven from the rule's
 * actions menu (`open` / `onOpenChange` come from there). Opened from a menu item, so
 * `useReturnFocus` returns focus on close.
 */
export function D4HNag_SetRuleEnabled_Dialog({
    rule,
    enabled,
    ...props
}: DialogProps & { rule: Rule; enabled: boolean }) {
    const organization = useOrganization();
    const returnFocus = useReturnFocus();

    const mutation = useMutation(
        trpc.d4hNag.updateRule.mutationOptions({
            meta: { effects: d4hNagEffects.updateRule },
            onError(error) {
                console.error(`Failed to ${enabled ? "enable" : "disable"} rule`, error);
                toast.error(`Failed to ${enabled ? "enable" : "disable"} rule: ${error.message}`);
            },
            onSuccess() {
                toast.success(enabled ? "Rule enabled" : "Rule disabled");
                props.onOpenChange?.(false);
            },
        }),
    );

    useEffect(() => {
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    return (
        <Dialog {...props}>
            <DialogContent {...returnFocus}>
                <DialogHeader>
                    <DialogTitle>{enabled ? "Enable Rule" : "Disable Rule"}</DialogTitle>
                    <DialogDescription>
                        {enabled ? (
                            <>
                                Start sending reminders for{" "}
                                <ObjectName>{rule.team.name}</ObjectName> again ({rule.schedule}).
                                If this week&apos;s reminder time has already passed, the first
                                reminder goes out next week.
                            </>
                        ) : (
                            <>
                                Stop sending reminders for <ObjectName>{rule.team.name}</ObjectName>{" "}
                                ({rule.schedule}). The rule and its run history are kept, and you
                                can enable it again later.
                            </>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={
                            enabled
                                ? { idle: "Enable", pending: "Enabling", success: "Enabled" }
                                : { idle: "Disable", pending: "Disabling", success: "Disabled" }
                        }
                        onClick={() =>
                            mutation.mutate({
                                organizationId: organization.id,
                                ruleId: rule.id,
                                enabled,
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
