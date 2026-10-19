/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { teamsEffects } from "@/client/teams-effects";
import { D4HIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
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
import { DialogBoundary } from "@/components/ui/dialog-boundary";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/hooks/use-organization";
import { getD4HServer } from "@/lib/d4h-servers";
import {
    D4HSyncPlan,
    isD4HSyncPlanEmpty,
    type D4HSyncItem,
    type D4HSyncItemOutcome,
    type D4HSyncSkipReason,
} from "@/lib/schemas/d4h-sync-plan";
import { TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

const ACTIONS = ["d4h-link", "d4h-sync", "d4h-unlink"] as const;

export function AdminModule_Team_D4HCard({ team }: { team: TeamData }) {
    const organization = useOrganization();
    const settings = organization.settings;
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(ACTIONS));

    if (!settings.integrations.d4h.enabled) return null;

    return (
        <Protect permissions={{ team: ["update"] }}>
            <Card>
                <CardHeader>
                    <CardTitle>D4H Integration</CardTitle>
                    {team.d4h && (
                        <CardAction>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Sync with D4H"
                                title="Sync with D4H"
                                onClick={() => void setAction("d4h-sync", { history: "push" })}
                            >
                                <D4HIcons.Sync />
                            </Button>
                        </CardAction>
                    )}
                </CardHeader>
                <CardContent>
                    {team.d4h ? (
                        <DataList>
                            <DataItem inline>
                                <DataItemTitle>D4H Team</DataItemTitle>
                                <DataItemValue>
                                    {team.d4h.d4hTeamName}{" "}
                                    <span className="text-muted-foreground">
                                        (ID: {team.d4h.d4hTeamId})
                                    </span>
                                </DataItemValue>
                            </DataItem>
                            <DataItem inline>
                                <DataItemTitle>Server</DataItemTitle>
                                <DataItemValue>
                                    {getD4HServer(team.d4h.d4hServerCode).name}
                                </DataItemValue>
                            </DataItem>
                            <DataItem inline>
                                <DataItemTitle>D4H Organisation</DataItemTitle>
                                <DataItemValue>
                                    {team.d4h.d4hOrganisationId ? (
                                        <>
                                            {team.d4h.d4hOrganisationName}
                                            {team.d4h.d4hOrganisationName && " "}
                                            <span className="text-muted-foreground">
                                                (ID: {team.d4h.d4hOrganisationId})
                                            </span>
                                        </>
                                    ) : (
                                        "None (org-less team)"
                                    )}
                                </DataItemValue>
                            </DataItem>
                            <DataItem inline>
                                <DataItemTitle>Last synced</DataItemTitle>
                                {team.d4h.lastSyncedAt ? (
                                    <DataItemDateValue date={team.d4h.lastSyncedAt} />
                                ) : (
                                    <DataItemValue>Never</DataItemValue>
                                )}
                            </DataItem>
                        </DataList>
                    ) : (
                        <p className="text-muted-foreground text-sm">
                            This team is not linked to D4H.
                        </p>
                    )}
                </CardContent>
            </Card>

            <LinkDialog
                team={team}
                open={action === "d4h-link"}
                onClose={() => void setAction(null, { history: "replace" })}
            />
            <SyncDialog
                team={team}
                open={action === "d4h-sync"}
                onClose={() => void setAction(null, { history: "replace" })}
            />
            <UnlinkDialog
                team={team}
                open={action === "d4h-unlink"}
                onClose={() => void setAction(null, { history: "replace" })}
            />
        </Protect>
    );
}

function UnlinkDialog({
    team,
    open,
    onClose,
}: {
    team: TeamData;
    open: boolean;
    onClose: () => void;
}) {
    const organization = useOrganization();

    const mutation = useMutation(
        trpc.teams.unlinkTeamFromD4H.mutationOptions({
            meta: { effects: teamsEffects.unlinkTeamFromD4H },
            onError: (error) => toast.error(`Failed to unlink: ${error.message}`),
            onSuccess: () => {
                toast.success("Unlinked from D4H");
                onClose();
            },
        }),
    );

    useEffect(() => {
        if (open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Unlink {team.name} from D4H</DialogTitle>
                    <DialogDescription>
                        Removes the D4H link and cached team data. Personnel and their memberships
                        stay in AVUT — they just stop being D4H-managed.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        variant="destructive"
                        status={mutation.status}
                        text={{ idle: "Unlink", pending: "Unlinking…", success: "Unlinked" }}
                        onClick={() =>
                            mutation.mutate({ organizationId: organization.id, teamId: team.id })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function LinkDialog({
    team,
    open,
    onClose,
}: {
    team: TeamData;
    open: boolean;
    onClose: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Link {team.name} to D4H</DialogTitle>
                    <DialogDescription>
                        Choose a D4H team visible to your personal access token. Its members will be
                        imported and kept in sync on demand. Syncing always uses the token of
                        whoever runs it.
                    </DialogDescription>
                </DialogHeader>
                {/* Mounted only while open, so the D4H team list loads (and its errors, such as no
                    personal token, show) only once the dialog opens. */}
                <DialogBoundary>
                    <LinkDialog_Body team={team} onClose={onClose} />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function LinkDialog_Body({ team, onClose }: { team: TeamData; onClose: () => void }) {
    const organization = useOrganization();
    const [d4hTeamId, setD4hTeamId] = useState<number | null>(null);

    const { data: availableTeams } = useSuspenseQuery(
        trpc.d4hApi.listTeamsAccessibleToUser.queryOptions({ organizationId: organization.id }),
    );

    const mutation = useMutation(
        trpc.teams.linkTeamToD4H.mutationOptions({
            meta: { effects: teamsEffects.linkTeamToD4H },
            onError: (error) => toast.error(error.message),
            onSuccess: ({ plan }) => {
                toast.success(
                    `Linked to D4H — ${plan.counts.additions} member(s) imported${describeSkipped(plan)}`,
                );
                onClose();
            },
        }),
    );

    return (
        <>
            <DialogBody>
                <Select
                    value={d4hTeamId ? String(d4hTeamId) : ""}
                    onValueChange={(v) => setD4hTeamId(Number(v))}
                >
                    <SelectTrigger disabled={availableTeams.length === 0}>
                        <SelectValue placeholder="Select a D4H team" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableTeams.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                                {t.title}
                                {t.owner ? ` — ${t.owner.title}` : " — (org-less)"}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </DialogBody>
            <DialogFooter>
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <MutationButton
                    status={mutation.status}
                    disabled={d4hTeamId == null}
                    text={{ idle: "Link & sync", pending: "Linking…", success: "Linked" }}
                    onClick={() =>
                        d4hTeamId != null &&
                        mutation.mutate({
                            organizationId: organization.id,
                            teamId: team.id,
                            d4hTeamId,
                        })
                    }
                />
            </DialogFooter>
        </>
    );
}

function SyncDialog({
    team,
    open,
    onClose,
}: {
    team: TeamData;
    open: boolean;
    onClose: () => void;
}) {
    const organization = useOrganization();

    // Set while the server reports another sync of the team running, so the notice stays up while
    // the next poll is in flight instead of flashing back to "Loading preview…".
    const [running, setRunning] = useState(false);

    // Creating the plan writes a row, so it's a mutation fired on open (and on each poll or
    // refresh) rather than a query.
    const createPlan = useMutation(
        trpc.teams.createD4HTeamSyncPlan.mutationOptions({
            onSuccess: (result) => setRunning(result.status === "in-progress"),
            onError: () => setRunning(false),
        }),
    );

    // Whether the dialog is open, for the execute callbacks, which outlive a Back-button close.
    const openRef = useRef(open);

    const execute = useMutation(
        trpc.teams.executeD4HTeamSyncPlan.mutationOptions({
            meta: { effects: teamsEffects.executeD4HTeamSyncPlan },
            onError: (error) => {
                // A CONFLICT is shown in the dialog, with a way to refresh the preview.
                if (error.data?.code !== "CONFLICT") toast.error(`Sync failed: ${error.message}`);
            },
            onSuccess: ({ outcomes }) => {
                // The dialog shows the results; only a dialog closed mid-apply needs a toast.
                if (openRef.current) return;
                const applied = outcomes.filter((o) => o.result === "applied").length;
                toast.success(`Synced with D4H: ${applied} change(s) applied`);
            },
        }),
    );
    const applying = execute.isPending;

    // Items the user unticked, for the plan they were unticked on. A new plan starts all ticked.
    const [unticked, setUnticked] = useState<{ planId: string | null; itemIds: string[] }>({
        planId: null,
        itemIds: [],
    });

    function requestPlan() {
        createPlan.mutate({ organizationId: organization.id, teamId: team.id });
    }

    // Guards against StrictMode running the open effect twice, which would create two plans.
    const planRequested = useRef(false);

    useEffect(() => {
        openRef.current = open;
        if (!open) {
            planRequested.current = false;
            // Reset on close, so a reopen never shows the previous plan with Apply enabled. A
            // close mid-apply (the Back button) keeps both, and a reopen picks the apply back up.
            if (!execute.isPending) {
                createPlan.reset();
                execute.reset();
                setRunning(false);
            }
            return;
        }
        if (planRequested.current || execute.isPending) return;
        planRequested.current = true;
        execute.reset();
        requestPlan();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- act on the open transition only
    }, [open]);

    // While another sync of the team runs, create a plan again every few seconds.
    useEffect(() => {
        if (!open || createPlan.data?.status !== "in-progress") return;
        const timer = setTimeout(requestPlan, POLL_INTERVAL_MS);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arm on each poll result only
    }, [open, createPlan.data]);

    function refreshPreview() {
        execute.reset();
        createPlan.reset();
        requestPlan();
    }

    const ready = createPlan.data?.status === "ready" ? createPlan.data : null;
    const skipItemIds = ready && unticked.planId === ready.planId ? unticked.itemIds : [];
    const conflict = execute.error?.data?.code === "CONFLICT" ? execute.error : null;

    function setTicked(itemId: string, ticked: boolean) {
        if (!ready) return;
        setUnticked({
            planId: ready.planId,
            itemIds: ticked
                ? skipItemIds.filter((id) => id !== itemId)
                : [...skipItemIds.filter((id) => id !== itemId), itemId],
        });
    }

    const tickedCount = ready
        ? selectableItems(ready.plan).filter((i) => !skipItemIds.includes(i.itemId)).length
        : 0;

    return (
        <Dialog
            open={open}
            // Not dismissable while applying: closing would hide the run, not stop it.
            onOpenChange={(o) => (o || applying ? undefined : onClose())}
        >
            <DialogContent showCloseButton={!applying}>
                <DialogHeader>
                    <DialogTitle>Sync {team.name} with D4H</DialogTitle>
                    <DialogDescription>
                        {execute.isSuccess
                            ? "The sync is complete."
                            : "Review the changes, untick any you don't want, then apply them."}
                    </DialogDescription>
                </DialogHeader>
                {execute.isSuccess ? (
                    <>
                        <DialogBody>
                            <SyncResultView
                                plan={execute.data.plan.payload}
                                outcomes={execute.data.outcomes}
                            />
                        </DialogBody>
                        <DialogFooter>
                            <DialogCloseButton>Close</DialogCloseButton>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogBody>
                            {createPlan.isError ? (
                                <p className="text-destructive text-sm">
                                    {createPlan.error.message}
                                </p>
                            ) : ready ? (
                                <div className="space-y-3">
                                    {conflict && (
                                        <p className="text-destructive text-sm">
                                            {conflict.message}
                                        </p>
                                    )}
                                    <SyncPlanView
                                        plan={ready.plan}
                                        skipItemIds={skipItemIds}
                                        onTickedChange={setTicked}
                                        disabled={applying || conflict !== null}
                                    />
                                </div>
                            ) : running ? (
                                <p className="text-sm">
                                    A sync of this team is running. The preview will appear once it
                                    finishes.
                                </p>
                            ) : (
                                <p className="text-sm">Loading preview…</p>
                            )}
                        </DialogBody>
                        <DialogFooter>
                            <DialogCloseButton variant="outline" disabled={applying}>
                                Cancel
                            </DialogCloseButton>
                            {conflict ? (
                                <Button onClick={refreshPreview}>Refresh preview</Button>
                            ) : (
                                <MutationButton
                                    status={execute.status}
                                    disabled={!ready || tickedCount === 0}
                                    text={{
                                        idle: "Apply",
                                        pending: "Applying…",
                                        success: "Applied",
                                    }}
                                    onClick={() =>
                                        ready &&
                                        execute.mutate({
                                            organizationId: organization.id,
                                            planId: ready.planId,
                                            skipItemIds,
                                        })
                                    }
                                />
                            )}
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

/** How often the sync dialog creates a plan again while another sync of the team runs. */
const POLL_INTERVAL_MS = 3_000;

/** How the link toast names each reason a D4H member wasn't imported. */
const SKIP_REASON_LABELS: Record<D4HSyncSkipReason, string> = {
    "missing-email": "no email",
    "person-in-rubbish-bin": "person in the Rubbish bin",
    "duplicate-email": "email shared by several D4H members",
    "membership-in-rubbish-bin": "membership in the Rubbish bin",
    "linked-to-another-member": "person linked to another D4H member",
};

/** The link toast's skipped suffix, e.g. `, 3 skipped (2 no email, 1 person in the Rubbish bin)`. */
function describeSkipped(plan: D4HSyncPlan): string {
    if (plan.skipped.length === 0) return "";
    const parts = (Object.keys(SKIP_REASON_LABELS) as D4HSyncSkipReason[]).flatMap((reason) => {
        const count = plan.skipped.filter((s) => s.reason === reason).length;
        return count === 0 ? [] : [`${count} ${SKIP_REASON_LABELS[reason]}`];
    });
    return `, ${plan.skipped.length} skipped (${parts.join(", ")})`;
}

/** The sync dialog's item groups, in the order shown (the execution order). */
const ITEM_GROUP_TITLES: Record<D4HSyncItem["kind"], string> = {
    add: "Add",
    relink: "Re-link",
    update: "Update",
    reactivate: "Reactivate",
    archive: "Archive",
    metadata: "Team metadata",
};

/** How each plan-time skip reason is headed in the sync preview. */
const SKIPPED_GROUP_TITLES: Record<D4HSyncSkipReason, string> = {
    "missing-email": "Skipped (no email in D4H)",
    "person-in-rubbish-bin":
        "Skipped (email belongs to a person in the Rubbish bin — recover or delete them forever to import)",
    "duplicate-email": "Skipped (email shared by several D4H members)",
    "membership-in-rubbish-bin": "Skipped (team membership in the Rubbish bin)",
    "linked-to-another-member": "Skipped (person already linked to another D4H member)",
};

/**
 * Why an item the user left ticked wasn't applied: the `reason` of a `skipped-changed` outcome.
 * Keyed by the strings the executor in `src/server/services/d4h-team-sync.ts` returns.
 */
const OUTCOME_REASON_LABELS: Record<string, string> = {
    "already-linked": "the D4H member is already linked to a membership on this team",
    "person-in-rubbish-bin": "the person is in the Rubbish bin",
    "membership-in-rubbish-bin": "the team membership is in the Rubbish bin",
    "linked-to-another-member": "the membership is linked to another D4H member",
    "membership-missing": "the team membership no longer exists",
    "d4h-member-changed": "the membership is now linked to a different D4H member",
    "details-changed": "the membership's D4H details changed since the preview",
    "not-archived": "the membership is no longer archived",
    "not-active": "the membership is no longer active",
    "fields-changed": "every changed field was edited since the preview",
};

/** The rows an item shows as, in the preview and the results. */
function itemLabel(item: D4HSyncItem): string {
    switch (item.kind) {
        case "add":
            return `${item.personName} (${item.email})`;
        case "metadata":
            return `${item.changes.length} field(s) changed`;
        default:
            return item.personName;
    }
}

/** The items the user can tick or untick: every item except a metadata item with no changes. */
function selectableItems(plan: D4HSyncPlan): D4HSyncItem[] {
    return plan.items.filter((i) => i.kind !== "metadata" || i.changes.length > 0);
}

function SyncPlanView({
    plan,
    skipItemIds,
    onTickedChange,
    disabled,
}: {
    plan: D4HSyncPlan;
    skipItemIds: readonly string[];
    onTickedChange: (itemId: string, ticked: boolean) => void;
    disabled: boolean;
}) {
    const items = selectableItems(plan);
    return (
        <div className="space-y-3 text-sm">
            {isD4HSyncPlanEmpty(plan) && (
                <p className="text-muted-foreground text-sm">Already in sync.</p>
            )}
            {(Object.keys(ITEM_GROUP_TITLES) as D4HSyncItem["kind"][]).map((kind) => {
                const rows = items.filter((i) => i.kind === kind);
                if (rows.length === 0) return null;
                return (
                    <div key={kind}>
                        <p className="font-medium">
                            {ITEM_GROUP_TITLES[kind]} ({rows.length})
                        </p>
                        <ul className="mt-1 space-y-1">
                            {rows.map((item) => (
                                <li key={item.itemId}>
                                    <label className="flex items-center gap-2">
                                        <Checkbox
                                            checked={!skipItemIds.includes(item.itemId)}
                                            onCheckedChange={(checked) =>
                                                onTickedChange(item.itemId, checked === true)
                                            }
                                            disabled={disabled}
                                        />
                                        {itemLabel(item)}
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
            {(Object.keys(SKIPPED_GROUP_TITLES) as D4HSyncSkipReason[]).map((reason) => (
                <Group
                    key={reason}
                    title={SKIPPED_GROUP_TITLES[reason]}
                    rows={plan.skipped.filter((s) => s.reason === reason).map((s) => s.name)}
                />
            ))}
        </div>
    );
}

function SyncResultView({
    plan,
    outcomes,
}: {
    plan: D4HSyncPlan;
    outcomes: readonly D4HSyncItemOutcome[];
}) {
    const items = new Map(selectableItems(plan).map((i) => [i.itemId, i]));
    // A metadata item with nothing to change still runs; it isn't a change worth counting.
    const shown = outcomes.filter((o) => items.has(o.itemId));
    const count = (result: D4HSyncItemOutcome["result"]) =>
        shown.filter((o) => o.result === result).length;

    const changed = shown.flatMap((o) => {
        const item = items.get(o.itemId);
        if (!item) return [];
        const name =
            item.kind === "metadata"
                ? ITEM_GROUP_TITLES.metadata
                : `${ITEM_GROUP_TITLES[item.kind]} ${item.personName}`;
        if (o.result === "skipped-changed") {
            const reason = o.reason ? (OUTCOME_REASON_LABELS[o.reason] ?? o.reason) : "it changed";
            return [`${name}: ${reason}`];
        }
        if (o.result === "applied" && o.skippedFields?.length) {
            return [`${name}: left ${o.skippedFields.join(", ")} alone, edited since the preview`];
        }
        return [];
    });

    return (
        <div className="space-y-3 text-sm">
            <DataList>
                <DataItem inline>
                    <DataItemTitle>Applied</DataItemTitle>
                    <DataItemValue>{count("applied")}</DataItemValue>
                </DataItem>
                <DataItem inline>
                    <DataItemTitle>Skipped by you</DataItemTitle>
                    <DataItemValue>{count("skipped-by-user")}</DataItemValue>
                </DataItem>
                <DataItem inline>
                    <DataItemTitle>Skipped (changed since the preview)</DataItemTitle>
                    <DataItemValue>{count("skipped-changed")}</DataItemValue>
                </DataItem>
            </DataList>
            <Group title="Not applied as previewed" rows={changed} />
        </div>
    );
}

function Group({ title, rows }: { title: string; rows: string[] }) {
    if (rows.length === 0) return null;
    return (
        <div>
            <p className="font-medium">
                {title} ({rows.length})
            </p>
            <ul className="text-muted-foreground list-inside list-disc">
                {rows.map((r, i) => (
                    <li key={i}>{r}</li>
                ))}
            </ul>
        </div>
    );
}
