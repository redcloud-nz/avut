/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

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
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { DialogBoundary } from "@/components/ui/dialog-boundary";
import { useActionHotkeys } from "@/hooks/use-action-hotkeys";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { trpc } from "@/trpc/client";

import { D4HNag_RuleFormFields, D4HNagRuleFormSchema } from "./rule-form";

/**
 * `?action=create` — self-triggered (Recipe A): the trigger button lives here, and the dialog
 * stays mounted on the rules list through the create. The rule has no page of its own yet, so a
 * successful create closes the dialog and the new rule appears in the list.
 */
export function D4HNag_CreateRule_Dialog() {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["create"] as const));
    const dialogOpen = action === "create";

    const canCreate = useHasPermission({ d4hNag: ["update"] });
    useActionHotkeys([
        {
            verb: "create",
            run: () => void setAction("create", { history: "push" }),
            enabled: canCreate,
            name: "New rule",
            category: "D4H Attendance Reminders",
        },
    ]);

    function handleDialogOpenChange(open: boolean) {
        void setAction(open ? "create" : null, { history: open ? "push" : "replace" });
    }

    return (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <ObjectIcons.Create /> <span className="sr-only md:not-sr-only">New Rule</span>
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New Rule</DialogTitle>
                    <DialogDescription>
                        Each week at the chosen time, email the team&apos;s members who haven&apos;t
                        answered their invitation to an upcoming D4H exercise.
                    </DialogDescription>
                </DialogHeader>
                <DialogBoundary>
                    <CreateRule_Body onDone={() => handleDialogOpenChange(false)} />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function CreateRule_Body({ onDone }: { onDone: () => void }) {
    const organization = useOrganization();

    const { data: teams } = useSuspenseQuery(
        trpc.d4hNag.listEligibleTeams.queryOptions({ organizationId: organization.id }),
    );

    const formId = useId();
    const form = useForm({
        resolver: zodResolver(D4HNagRuleFormSchema),
        defaultValues: {
            teamId: teams.length === 1 ? teams[0].id : undefined,
            weekday: 1,
            hour: 19,
            lookAheadHours: 24,
            message: "",
        },
    });

    const mutation = useMutation(
        trpc.d4hNag.createRule.mutationOptions({
            meta: { effects: d4hNagEffects.createRule },
            onError(error) {
                console.error("Failed to create rule", error);
                toast.error(`Failed to create rule: ${error.message}`);
            },
            onSuccess() {
                toast.success("Rule created");
                onDone();
            },
        }),
    );

    const handleSubmit = form.handleSubmit(
        (formData) => mutation.mutate({ organizationId: organization.id, ...formData }),
        (errors) => console.warn("Form validation errors:", errors),
    );

    return (
        <>
            <DialogBody>
                <form id={formId} onSubmit={handleSubmit}>
                    <D4HNag_RuleFormFields control={form.control} teams={teams} />
                </form>
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    type="submit"
                    form={formId}
                    disabled={teams.length === 0}
                    status={mutation.status}
                    text={{ idle: "Create", pending: "Creating", success: "Created" }}
                />
            </DialogFooter>
        </>
    );
}
