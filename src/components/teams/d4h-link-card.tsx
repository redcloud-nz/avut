/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { RefObject, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { teamsEffects } from "@/client/teams-effects";
import { D4HIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button, MutationButton } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
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
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { type MenuActionProps } from "@/components/ui/menu-action";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { ActionsCard, RecordCardMenu } from "@/components/ui/record-card-actions";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { getD4HServer } from "@/lib/d4h-servers";
import {
    D4HSyncPlan,
    isD4HSyncPlanEmpty,
    type D4HSyncChangedReason,
    type D4HSyncItem,
    type D4HSyncItemOutcome,
    type D4HSyncMetadataFieldKey,
    type D4HSyncSkipReason,
} from "@/lib/schemas/d4h-sync-plan";
import { TeamData } from "@/lib/schemas/team";
import { trpc, trpcClient } from "@/trpc/client";

const ACTIONS = ["d4h-link", "d4h-sync", "d4h-unlink"] as const;

/**
 * The bare action card for a team's secondary column: Link to D4H team, for an Active team
 * with no link while the D4H integration is on. Renders nothing otherwise. The button only sets
 * `?action=`; `Teams_D4HCard` renders the dialog (which reports a missing personal D4H token
 * when it opens).
 */
export function Teams_D4HLink_ActionsCard({ team }: { team: TeamData }) {
    const organization = useOrganization();
    const [, setAction] = useQueryState("action", parseAsStringLiteral(ACTIONS));
    const canUpdate = useHasPermission({ team: ["update"] });

    const canLink =
        organization.settings.integrations.d4h.enabled &&
        team.d4h === null &&
        team.status === "Active" &&
        canUpdate;

    return (
        <ActionsCard>
            {canLink ? (
                <Button
                    variant="outline"
                    onClick={() => void setAction("d4h-link", { history: "push" })}
                >
                    <D4HIcons.Link /> Link to D4H team
                </Button>
            ) : null}
        </ActionsCard>
    );
}

/**
 * The Linked D4H Team card (a sync icon and a ⋮ with Unlink), shown while the team is linked,
 * and the D4H link, sync and unlink dialogs, mounted whether or not it is.
 */
export function Teams_D4HCard({
    team,
    onChanged,
    returnFocusRef,
}: {
    team: TeamData;
    /**
     * Called after a successful link, unlink or sync, only once the `?action` change has landed
     * (for a sync, when its dialog closes), so a `router.refresh()` here can't reopen a dialog.
     */
    onChanged?: () => void;
    /**
     * Where the dialogs return focus once the control that opened them is gone (Link's action
     * card after a link, this card's ⋮ after an unlink): the Team card's pencil, which everyone
     * who can open them (`team: ["update"]`) sees.
     */
    returnFocusRef?: RefObject<HTMLElement | null>;
}) {
    const organization = useOrganization();
    const settings = organization.settings;
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(ACTIONS));

    if (!settings.integrations.d4h.enabled) return null;

    // The whole card is behind `team: ["update"]`, so Unlink is always there to offer.
    const menuActions: MenuActionProps[] = [
        {
            verb: "unlink",
            label: "Unlink from D4H",
            icon: <D4HIcons.Unlink />,
            onSelect: () => void setAction("d4h-unlink", { history: "push" }),
            destructive: true,
        },
    ];

    return (
        <Protect permissions={{ team: ["update"] }}>
            {/* A related record's card, like the person page's Linked User: shown only when
                there is a link. Linking is the secondary column's action card. */}
            {team.d4h && (
                <RecordCard
                    label="Linked D4H Team"
                    action={
                        <>
                            {/* Sync is for an Active team, as the old menu offered it. */}
                            {team.status === "Active" && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Sync with D4H"
                                    title="Sync with D4H"
                                    onClick={() => void setAction("d4h-sync", { history: "push" })}
                                >
                                    <D4HIcons.Sync />
                                </Button>
                            )}
                            <RecordCardMenu
                                actions={menuActions}
                                category="Teams"
                                label="Linked D4H team actions"
                            />
                        </>
                    }
                >
                    <CardContent>
                        <DataList>
                            <RecordCardId label="D4H Team ID" id={String(team.d4h.d4hTeamId)} />
                            <DataItem>
                                <DataItemTitle>Name</DataItemTitle>
                                <DataItemValue>{team.d4h.d4hTeamName}</DataItemValue>
                            </DataItem>
                            <DataItem>
                                <DataItemTitle>Server</DataItemTitle>
                                <DataItemValue>
                                    {getD4HServer(team.d4h.d4hServerCode).name}
                                </DataItemValue>
                            </DataItem>
                            <DataItem>
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
                            <DataItem>
                                <DataItemTitle>Last synced</DataItemTitle>
                                {team.d4h.lastSyncedAt ? (
                                    <DataItemDateValue date={team.d4h.lastSyncedAt} />
                                ) : (
                                    <DataItemValue>Never</DataItemValue>
                                )}
                            </DataItem>
                        </DataList>
                    </CardContent>
                </RecordCard>
            )}

            <LinkDialog
                team={team}
                returnFocusRef={returnFocusRef}
                open={action === "d4h-link"}
                onClose={() => void setAction(null, { history: "replace" })}
                // The link imports nobody: the sync preview takes over, in place of the link
                // dialog's history entry, so Back closes it rather than reopening the link dialog.
                onLinked={async () => {
                    await setAction("d4h-sync", { history: "replace" });
                    onChanged?.();
                }}
            />
            <SyncDialog
                team={team}
                returnFocusRef={returnFocusRef}
                open={action === "d4h-sync"}
                onClose={() => setAction(null, { history: "replace" })}
                onSynced={onChanged}
            />
            <UnlinkDialog
                team={team}
                returnFocusRef={returnFocusRef}
                open={action === "d4h-unlink"}
                onClose={() => void setAction(null, { history: "replace" })}
                onUnlinked={async () => {
                    await setAction(null, { history: "replace" });
                    onChanged?.();
                }}
            />
        </Protect>
    );
}

function UnlinkDialog({
    team,
    returnFocusRef,
    open,
    onClose,
    onUnlinked,
}: {
    team: TeamData;
    returnFocusRef?: RefObject<HTMLElement | null>;
    open: boolean;
    onClose: () => void;
    /** Closes the dialog after a successful unlink, in place of `onClose`. */
    onUnlinked: () => void;
}) {
    const organization = useOrganization();
    const returnFocus = useReturnFocus(returnFocusRef);

    const mutation = useMutation(
        trpc.teams.unlinkTeamFromD4H.mutationOptions({
            meta: { effects: teamsEffects.unlinkTeamFromD4H },
            onError: (error) => toast.error(`Failed to unlink: ${error.message}`),
            onSuccess: () => {
                toast.success("Unlinked from D4H");
                onUnlinked();
            },
        }),
    );

    useEffect(() => {
        if (open) mutation.reset();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
            <DialogContent {...returnFocus}>
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
    returnFocusRef,
    open,
    onClose,
    onLinked,
}: {
    team: TeamData;
    returnFocusRef?: RefObject<HTMLElement | null>;
    open: boolean;
    onClose: () => void;
    onLinked: () => void;
}) {
    const returnFocus = useReturnFocus(returnFocusRef);

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
            <DialogContent {...returnFocus}>
                <DialogHeader>
                    <DialogTitle>Link {team.name} to D4H</DialogTitle>
                    <DialogDescription>
                        Choose a D4H team visible to your personal access token. Next you&apos;ll
                        preview its members before any are imported, and after that sync on demand.
                        Syncing always uses the token of whoever runs it.
                    </DialogDescription>
                </DialogHeader>
                {/* Mounted only while open, so the D4H team list loads (and its errors, such as no
                    personal token, show) only once the dialog opens. */}
                <DialogBoundary>
                    <LinkDialog_Body team={team} onLinked={onLinked} />
                </DialogBoundary>
            </DialogContent>
        </Dialog>
    );
}

function LinkDialog_Body({ team, onLinked }: { team: TeamData; onLinked: () => void }) {
    const organization = useOrganization();
    const [d4hTeamId, setD4hTeamId] = useState<number | null>(null);

    const { data: availableTeams } = useSuspenseQuery(
        trpc.d4hApi.listTeamsAccessibleToUser.queryOptions({ organizationId: organization.id }),
    );

    const mutation = useMutation(
        trpc.teams.linkTeamToD4H.mutationOptions({
            meta: { effects: teamsEffects.linkTeamToD4H },
            onError: (error) => toast.error(error.message),
            onSuccess: () => {
                toast.success("Linked to D4H");
                onLinked();
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
                    text={{ idle: "Link", pending: "Linking…", success: "Linked" }}
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
    returnFocusRef,
    open,
    onClose,
    onSynced,
}: {
    team: TeamData;
    /** Opened by a link, the sync takes over from the Link dialog, whose button is gone. */
    returnFocusRef?: RefObject<HTMLElement | null>;
    open: boolean;
    /** Clears `?action`; resolves once the URL has changed. */
    onClose: () => Promise<unknown>;
    /** Called when the dialog closes after a successful sync, once `?action` is cleared. */
    onSynced?: () => void;
}) {
    const organization = useOrganization();
    const returnFocus = useReturnFocus(returnFocusRef);

    // Each open (and each "Refresh preview") is a new attempt, and so a new plan. 0 = not yet opened.
    const [attempt, setAttempt] = useState(0);

    // Whether the dialog is open, for the execute callbacks, which outlive a Back-button close.
    const openRef = useRef(open);

    // A sync succeeded while the dialog was open: `onSynced` waits for the close.
    const syncedRef = useRef(false);

    async function close() {
        const synced = syncedRef.current;
        syncedRef.current = false;
        await onClose();
        if (synced) onSynced?.();
    }

    const execute = useMutation(
        trpc.teams.executeD4HTeamSyncPlan.mutationOptions({
            meta: { effects: teamsEffects.executeD4HTeamSyncPlan },
            onError: (error) => {
                // A CONFLICT is shown in the dialog, with a way to refresh the preview.
                // A dialog closed mid-apply can't show it, so it toasts too.
                if (error.data?.code !== "CONFLICT" || !openRef.current) {
                    toast.error(`Sync failed: ${error.message}`);
                }
            },
            onSuccess: ({ plan, outcomes }) => {
                // The dialog shows the results; `onSynced` waits until it closes.
                if (openRef.current) {
                    syncedRef.current = true;
                    return;
                }
                // Closed mid-apply: `?action` is already gone.
                onSynced?.();
                // Count the items the user could tick, as the result view does (not a no-op
                // metadata item).
                const counted = new Set(selectableItems(plan.payload).map((i) => i.itemId));
                const applied = outcomes.filter(
                    (o) => o.result === "applied" && counted.has(o.itemId),
                ).length;
                toast.success(`Synced with D4H: ${applied} change(s) applied`);
            },
            onSettled: () => {
                // A run that settles after a close has had its toast; drop its result so a
                // reopen doesn't flash the previous result view before the open effect resets it.
                if (!openRef.current) execute.reset();
            },
        }),
    );
    const applying = execute.isPending;

    // An unmount while open (e.g. navigating away) leaves no dialog to show the result in.
    useEffect(
        () => () => {
            openRef.current = false;
        },
        [],
    );

    // Items the user unticked, for the plan they were unticked on. A new plan starts all ticked.
    const [unticked, setUnticked] = useState<{ planId: string | null; itemIds: string[] }>({
        planId: null,
        itemIds: [],
    });

    // Creating the plan writes a row, so the procedure is a mutation. It's loaded through a query
    // keyed on the attempt, not `useMutation` fired from an effect: StrictMode's simulated unmount
    // detaches a mutation observer and its result never arrives, while a query re-attaches and
    // de-duplicates the in-flight request. While another sync of the team runs, it polls.
    const createPlan = useQuery({
        queryKey: ["d4h-team-sync-plan", organization.id, team.id, attempt],
        queryFn: () =>
            trpcClient.teams.createD4HTeamSyncPlan.mutate({
                organizationId: organization.id,
                teamId: team.id,
            }),
        enabled: open && attempt > 0,
        staleTime: Infinity,
        gcTime: 0,
        retry: false,
        refetchOnWindowFocus: false,
        refetchInterval: (query) =>
            query.state.data?.status === "in-progress" ? POLL_INTERVAL_MS : false,
    });

    // A new attempt on each open transition. The ref survives StrictMode's double effect, so one
    // open is one plan.
    const wasOpen = useRef(false);

    useEffect(() => {
        openRef.current = open;
        if (!open) {
            wasOpen.current = false;
            // Closed by the Back button after a sync: the URL has already changed.
            if (syncedRef.current) {
                syncedRef.current = false;
                onSynced?.();
            }
            // A close mid-apply (the Back button) keeps the apply, and a reopen picks it back up.
            if (!execute.isPending) execute.reset();
            return;
        }
        if (wasOpen.current) return;
        wasOpen.current = true;
        if (execute.isPending) return;
        execute.reset();
        setAttempt((a) => a + 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- act on the open transition only
    }, [open]);

    function refreshPreview() {
        execute.reset();
        setAttempt((a) => a + 1);
    }

    // Kept on screen while a poll is in flight, so the notice doesn't flash back to loading.
    const running = createPlan.data?.status === "in-progress";
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
            onOpenChange={(o) => (o || applying ? undefined : void close())}
        >
            <DialogContent showCloseButton={!applying} {...returnFocus}>
                <DialogHeader>
                    <DialogTitle>Sync {team.name} with D4H</DialogTitle>
                    <DialogDescription>
                        {execute.isSuccess
                            ? "The sync is complete."
                            : ready && selectableItems(ready.plan).length > 0
                              ? "Review the changes, untick any you don't want, then apply them."
                              : "Compares this team with its linked D4H team."}
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

/** Why an item the user left ticked wasn't applied: the `reason` of a `skipped-changed` outcome. */
const OUTCOME_REASON_LABELS: Record<D4HSyncChangedReason, string> = {
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

/** The metadata fields an outcome's `skippedFields` names, as the result view shows them. */
const METADATA_FIELD_LABELS: Record<D4HSyncMetadataFieldKey, string> = {
    d4hTeamName: "D4H team name",
    d4hOrganisationId: "D4H organisation",
    d4hTimezone: "team timezone",
    orgName: "organisation name",
    orgTimezone: "organisation timezone",
    orgCurrency: "currency",
    orgReportingStartDay: "reporting year start day",
    orgReportingStartMonth: "reporting year start month",
};

function metadataFieldLabel(key: string): string {
    return METADATA_FIELD_LABELS[key as D4HSyncMetadataFieldKey] ?? key;
}

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
    const idPrefix = useId();
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
                    <FieldSet key={kind} className="gap-1">
                        <FieldLegend variant="label" className="mb-0">
                            {ITEM_GROUP_TITLES[kind]} ({rows.length})
                        </FieldLegend>
                        <FieldGroup data-slot="checkbox-group" className="gap-1">
                            {rows.map((item) => {
                                const id = `${idPrefix}-sync-item-${item.itemId}`;
                                return (
                                    <Field orientation="horizontal" key={item.itemId}>
                                        <Checkbox
                                            id={id}
                                            checked={!skipItemIds.includes(item.itemId)}
                                            onCheckedChange={(checked) =>
                                                onTickedChange(item.itemId, checked === true)
                                            }
                                            disabled={disabled}
                                        />
                                        <FieldLabel htmlFor={id} className="font-normal">
                                            {itemLabel(item)}
                                        </FieldLabel>
                                    </Field>
                                );
                            })}
                        </FieldGroup>
                    </FieldSet>
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
            const reason = o.reason ? OUTCOME_REASON_LABELS[o.reason] : "it changed";
            return [`${name}: ${reason}`];
        }
        if (o.result === "applied" && o.skippedFields?.length) {
            return [
                `${name}: ${o.skippedFields.map(metadataFieldLabel).join(", ")} not changed (edited in AVUT since the preview)`,
            ];
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
