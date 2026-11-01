/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ChevronDownIcon, PlayIcon, ToggleLeftIcon, ToggleRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { d4hNagEffects } from "@/client/d4h-nag-effects";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { TeamLink } from "@/components/entity-links/team-link";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
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
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "D4H Attendance Reminders",
                        href: route("/orgs/[slug]/d4h-nag", { slug: organization.slug }),
                    },
                    {
                        label: "Rules",
                        href: route("/orgs/[slug]/d4h-nag", { slug: organization.slug }),
                    },
                    { label: title },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{title}</Saratoga.Title>
                        <Saratoga.Actions>
                            <Protect permissions={{ d4hNag: ["run"] }}>
                                <RunRule_Buttons rule={rule} />
                            </Protect>
                            <D4HNag_Rule_Menu rule={rule} />
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Rule Details</CardTitle>
                                    <CardAction>
                                        <Protect permissions={{ d4hNag: ["update"] }}>
                                            <D4HNag_UpdateRule_Dialog rule={rule} />
                                        </Protect>
                                    </CardAction>
                                </CardHeader>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Team</DataItemTitle>
                                            <DataItemValue>
                                                <TeamLink team={rule.team} />
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>When</DataItemTitle>
                                            <DataItemValue>
                                                {rule.schedule} (
                                                {organization.settings.general.timeZone})
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Window</DataItemTitle>
                                            <DataItemValue>
                                                {describeWindow(rule.lookAheadHours)}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Message</DataItemTitle>
                                            <DataItemValue className="whitespace-pre-line">
                                                {rule.message || (
                                                    <span className="text-muted-foreground">
                                                        None
                                                    </span>
                                                )}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Status</DataItemTitle>
                                            <DataItemValue>
                                                {rule.enabled ? "Enabled" : "Disabled"}
                                            </DataItemValue>
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>

                        <Saratoga.Column slot="secondary">
                            {paused && (
                                <Alert variant="warning">
                                    <AlertTitle>Paused: {paused.label}</AlertTitle>
                                    <AlertDescription>{paused.description}</AlertDescription>
                                </Alert>
                            )}
                            <Card>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Created</DataItemTitle>
                                            <DataItemDateValue date={rule.createdAt} />
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>

                    <section className="space-y-3 pt-4">
                        <h2 className="text-lg font-semibold tracking-tight">Runs</h2>
                        <D4HNag_Runs_Table ruleId={rule.id} />
                    </section>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}

const MENU_ACTIONS = ["update", "enable", "disable", "delete"] as const;

/**
 * The rule's actions menu: Edit, Enable or Disable, and Delete. Hosts the enable, disable and
 * delete dialogs; the update dialog owns its own param (it has a card trigger too).
 */
function D4HNag_Rule_Menu({ rule }: { rule: D4HNagRuleListItem }) {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(MENU_ACTIONS));
    const canUpdate = useHasPermission({ d4hNag: ["update"] });

    function dialogProps(verb: (typeof MENU_ACTIONS)[number]) {
        return {
            open: action === verb,
            onOpenChange: (open: boolean) =>
                void setAction(open ? verb : null, { history: open ? "push" : "replace" }),
        };
    }

    const actions: MenuActionProps[] = [
        {
            verb: "update",
            label: "Edit",
            icon: <ObjectIcons.Edit />,
            onSelect: () => void setAction("update", { history: "push" }),
            disabled: !canUpdate,
        },
        {
            verb: "delete",
            label: "Delete",
            icon: <ObjectIcons.Delete />,
            onSelect: () => void setAction("delete", { history: "push" }),
            disabled: !canUpdate,
            destructive: true,
        },
    ];

    return (
        <>
            <EntityActionMenu
                actions={actions}
                category="D4H Attendance Reminders"
                after={
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            {rule.enabled ? (
                                <DropdownMenuItem
                                    disabled={!canUpdate}
                                    onClick={() => void setAction("disable", { history: "push" })}
                                >
                                    <ToggleLeftIcon /> Disable
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem
                                    disabled={!canUpdate}
                                    onClick={() => void setAction("enable", { history: "push" })}
                                >
                                    <ToggleRightIcon /> Enable
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuGroup>
                    </>
                }
            />

            <D4HNag_SetRuleEnabled_Dialog rule={rule} enabled {...dialogProps("enable")} />
            <D4HNag_SetRuleEnabled_Dialog rule={rule} enabled={false} {...dialogProps("disable")} />
            <D4HNag_DeleteRule_Dialog rule={rule} {...dialogProps("delete")} />
        </>
    );
}

/**
 * The Run menu: Dry run and Run now. Both are refused for a paused rule, so they're disabled with the reason.
 * Both navigate to the new run, which finishes in the background; its page refetches until then.
 */
function RunRule_Buttons({ rule }: { rule: D4HNagRuleListItem }) {
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
                router.push(
                    route("/orgs/[slug]/d4h-nag/runs/[run_id]", {
                        slug: organization.slug,
                        run_id: runId,
                    }),
                );
            },
        }),
    );

    const pausedReason = rule.pausedReason ? describePausedReason(rule.pausedReason) : null;
    const disabled = pausedReason !== null || mutation.isPending;

    function run(dryRun: boolean) {
        mutation.mutate({ organizationId: organization.id, ruleId: rule.id, dryRun });
    }

    const trigger = (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={disabled}>
                    <PlayIcon />
                    <span className="sr-only sm:not-sr-only">Run</span>
                    <ChevronDownIcon className="max-sm:hidden" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => run(true)}>Dry Run</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => run(false)}>Run Now</DropdownMenuItem>
                </DropdownMenuGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    if (pausedReason) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    {/* A disabled button gets no pointer events, so the wrapper takes the hover
                        and focus instead. */}
                    <span tabIndex={0}>{trigger}</span>
                </TooltipTrigger>
                <TooltipContent>Paused: {pausedReason.label}</TooltipContent>
            </Tooltip>
        );
    }

    return trigger;
}
