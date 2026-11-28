/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { FlaskConicalIcon, PlayIcon, ToggleLeftIcon, ToggleRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { ComponentProps, useEffect } from "react";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { d4hNagEffects } from "@/client/d4h-nag-effects";
import { Saratoga } from "@/components/blocks/saratoga";
import { TeamLink } from "@/components/entity-links/team-link";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, MutationButton } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { type MenuActionProps } from "@/components/ui/menu-action";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { ActionsCard, RecordCardMenu } from "@/components/ui/record-card-actions";
import { D4HNagRuleStatusBadge } from "@/components/ui/status-badge";
import { ObjectName } from "@/components/ui/typography";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { route } from "@/lib/routes";
import type { D4HNagRuleId, D4HNagRuleListItem } from "@/lib/schemas/d4h-nag";
import { describeWindow } from "@/modules/d4h-nag/lib/describe-window";
import { describePausedReason } from "@/modules/d4h-nag/lib/paused-reason";
import { trpc } from "@/trpc/client";

import { D4HNag_DeleteRule_Dialog } from "./delete-rule-dialog";
import { D4HNag_Runs_Table } from "./runs-table";
import { D4HNag_SetRuleEnabled_Dialog, D4HNag_UpdateRule_Dialog } from "./update-rule-dialog";

/** A reminder rule: its settings, why it's paused (if it is) and its runs. */
export function D4HNag_Rule_Content({ ruleId }: { ruleId: D4HNagRuleId }) {
    const organization = useOrganization();

    const { data: rule } = useSuspenseQuery(
        trpc.d4hNag.getRule.queryOptions({ organizationId: organization.id, ruleId }),
    );

    const title = `${rule.team.name}: ${rule.schedule}`;
    const paused = rule.pausedReason ? describePausedReason(rule.pausedReason) : null;

    return (
        <Saratoga.Root>
            <Saratoga.Breadcrumbs
                items={[
                    {
                        label: "Rules",
                        href: route("/orgs/[slug]/d4h-nag", { slug: organization.slug }),
                    },
                ]}
            />
            <Saratoga.Header>
                <Saratoga.Title
                    badges={<D4HNagRuleStatusBadge enabled={rule.enabled} paused={!!paused} />}
                >
                    {title}
                </Saratoga.Title>
            </Saratoga.Header>

            {paused && (
                <Alert variant="warning">
                    <AlertTitle>Paused: {paused.label}</AlertTitle>
                    <AlertDescription>{paused.description}</AlertDescription>
                </Alert>
            )}

            <Saratoga.Columns>
                <Saratoga.Column slot="main">
                    <RecordCard
                        label="Rule"
                        action={
                            <>
                                <Protect permissions={{ d4hNag: ["update"] }}>
                                    <D4HNag_UpdateRule_Dialog rule={rule} primary />
                                </Protect>
                                <D4HNag_Rule_Menu rule={rule} />
                            </>
                        }
                    >
                        <CardContent>
                            <DataList>
                                <RecordCardId label="Rule ID" id={rule.id} />
                                <DataItem>
                                    <DataItemTitle>Team</DataItemTitle>
                                    <DataItemValue>
                                        <TeamLink team={rule.team} />
                                    </DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>When</DataItemTitle>
                                    <DataItemValue>
                                        {rule.schedule} ({organization.settings.general.timeZone})
                                    </DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Window</DataItemTitle>
                                    <DataItemValue>
                                        {describeWindow(rule.lookAheadHours)}
                                    </DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Message</DataItemTitle>
                                    <DataItemValue className="whitespace-pre-line">
                                        {rule.message || (
                                            <span className="text-muted-foreground">None</span>
                                        )}
                                    </DataItemValue>
                                </DataItem>
                            </DataList>
                        </CardContent>
                    </RecordCard>
                </Saratoga.Column>
                <Saratoga.Column slot="secondary">
                    <D4HNag_Rule_RunCard rule={rule} />
                </Saratoga.Column>
            </Saratoga.Columns>

            <section className="space-y-3 pt-4">
                <h2 className="text-lg font-semibold tracking-tight">Runs</h2>
                <D4HNag_Runs_Table ruleId={rule.id} />
            </section>
        </Saratoga.Root>
    );
}

/** Every `?action=` the rule page's dialogs answer to. Edit's dialog owns `update` itself. */
const RULE_ACTIONS = ["enable", "disable", "delete", "run-now"] as const;

/**
 * The Rule card's ⋮ (the page's primary record card): Enable or Disable, and Delete. Edit is the
 * card's pencil, Dry run and Run now the {@link D4HNag_Rule_RunCard}.
 *
 * Mounts every dialog on the page, whichever card or button opens it.
 */
function D4HNag_Rule_Menu({ rule }: { rule: D4HNagRuleListItem }) {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(RULE_ACTIONS));
    const canUpdate = useHasPermission({ d4hNag: ["update"] });
    const canRun = useHasPermission({ d4hNag: ["run"] });

    function dialogProps(verb: (typeof RULE_ACTIONS)[number]) {
        return {
            open: action === verb,
            onOpenChange: (open: boolean) =>
                void setAction(open ? verb : null, { history: open ? "push" : "replace" }),
        };
    }

    const actions: MenuActionProps[] = [];
    if (canUpdate) {
        actions.push(
            rule.enabled
                ? {
                      verb: "disable",
                      label: "Disable",
                      icon: <ToggleLeftIcon />,
                      onSelect: () => void setAction("disable", { history: "push" }),
                  }
                : {
                      verb: "enable",
                      label: "Enable",
                      icon: <ToggleRightIcon />,
                      onSelect: () => void setAction("enable", { history: "push" }),
                  },
            {
                verb: "delete",
                label: "Delete",
                icon: <ObjectIcons.Delete />,
                onSelect: () => void setAction("delete", { history: "push" }),
                destructive: true,
            },
        );
    }

    const { open: runNowOpen, onOpenChange: onRunNowOpenChange } = dialogProps("run-now");

    return (
        <>
            <RecordCardMenu actions={actions} category="D4H Attendance Reminders" primary />

            <D4HNag_SetRuleEnabled_Dialog rule={rule} enabled {...dialogProps("enable")} />
            <D4HNag_SetRuleEnabled_Dialog rule={rule} enabled={false} {...dialogProps("disable")} />
            <D4HNag_DeleteRule_Dialog rule={rule} {...dialogProps("delete")} />
            <D4HNag_RunRuleNow_Dialog
                rule={rule}
                // A paused rule refuses to run, and the Run card is hidden then: a hand-typed
                // `?action=run-now` does nothing.
                open={runNowOpen && canRun && !rule.pausedReason}
                onOpenChange={onRunNowOpenChange}
            />
        </>
    );
}

/** Starts a run of the rule, then goes to the run's page (it finishes in the background, and its
 *  page refetches until then). */
function useRunRule(rule: Pick<D4HNagRuleListItem, "id">) {
    const organization = useOrganization();
    const router = useRouter();

    const mutation = useMutation(
        trpc.d4hNag.runRule.mutationOptions({
            meta: { effects: d4hNagEffects.runRule, navigates: true },
            onError(error) {
                console.error("Failed to start run", error);
                toast.error(`Failed to start run: ${error.message}`);
            },
            onSuccess({ runId }, { dryRun }) {
                toast.success(dryRun ? "Dry run started. Nothing will be sent." : "Run started.");
                // Navigation is the whole close of the Run now dialog: don't also clear the param.
                router.push(
                    route("/orgs/[slug]/d4h-nag/runs/[run_id]", {
                        slug: organization.slug,
                        run_id: runId,
                    }),
                );
            },
        }),
    );

    function run(dryRun: boolean) {
        mutation.mutate({ organizationId: organization.id, ruleId: rule.id, dryRun });
    }

    return { mutation, run };
}

/**
 * The titled Run card at the top of the rule's secondary column, for a viewer who can run rules:
 * Dry run starts one straight away, Run now asks first (it sends real email). Hidden while the
 * rule is paused, which refuses both (the paused banner says why). The Run now dialog is in
 * {@link D4HNag_Rule_Menu}.
 */
function D4HNag_Rule_RunCard({ rule }: { rule: D4HNagRuleListItem }) {
    const [, setAction] = useQueryState("action", parseAsStringLiteral(RULE_ACTIONS));
    const canRun = useHasPermission({ d4hNag: ["run"] });
    const { mutation, run } = useRunRule(rule);

    const show = canRun && !rule.pausedReason;

    return (
        <ActionsCard
            title="Run"
            description="Remind the team now instead of waiting for the schedule. A dry run shows who would be reminded without sending anything."
        >
            {show ? (
                <Button variant="outline" disabled={mutation.isPending} onClick={() => run(true)}>
                    <FlaskConicalIcon /> Dry run
                </Button>
            ) : null}
            {show ? (
                <Button
                    variant="outline"
                    disabled={mutation.isPending}
                    onClick={() => void setAction("run-now", { history: "push" })}
                >
                    <PlayIcon /> Run now
                </Button>
            ) : null}
        </ActionsCard>
    );
}

/**
 * `?action=run-now` confirm: Run now emails the team's members, so it asks first. Host-driven
 * from {@link D4HNag_Rule_Menu}; opened from the Run card's button, which stays put, so
 * `useReturnFocus` returns focus to it on Cancel. On success the page goes to the new run.
 */
function D4HNag_RunRuleNow_Dialog({
    rule,
    ...props
}: ComponentProps<typeof AlertDialog> & {
    rule: Pick<D4HNagRuleListItem, "id" | "team" | "lookAheadHours">;
}) {
    const returnFocus = useReturnFocus();
    const { mutation, run } = useRunRule(rule);

    useEffect(() => {
        if (props.open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh state on the open transition only
    }, [props.open]);

    return (
        <AlertDialog {...props}>
            <AlertDialogContent {...returnFocus}>
                <AlertDialogHeader>
                    <AlertDialogTitle>Run Now</AlertDialogTitle>
                    <AlertDialogDescription>
                        Email the members of <ObjectName>{rule.team.name}</ObjectName> whose
                        attendance on a D4H exercise in the{" "}
                        {describeWindow(rule.lookAheadHours).toLowerCase()} is still Requested. No
                        one is reminded about the same exercise twice.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        status={mutation.status}
                        text={{ idle: "Send reminders", pending: "Starting", success: "Started" }}
                        onClick={() => run(false)}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
