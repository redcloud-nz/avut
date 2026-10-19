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

    // Creating the plan writes a row, so it's a mutation fired once per open rather than a query.
    const createPlan = useMutation(trpc.teams.createD4HTeamSyncPlan.mutationOptions());

    const mutation = useMutation(
        trpc.teams.executeD4HTeamSyncPlan.mutationOptions({
            meta: { effects: teamsEffects.executeD4HTeamSyncPlan },
            onError: (error) => toast.error(`Sync failed: ${error.message}`),
            onSuccess: ({ plan: { payload } }) => {
                const c = payload.counts;
                toast.success(
                    `Synced: +${c.additions} relinked ${c.relinks} ~${c.updates} ` +
                        `archived ${c.archivals} reactivated ${c.reactivations} ` +
                        `skipped ${c.skipped}`,
                );
                onClose();
            },
        }),
    );

    // Guards against StrictMode running the open effect twice, which would create two plans.
    const planRequested = useRef(false);

    useEffect(() => {
        if (!open) {
            planRequested.current = false;
            return;
        }
        if (planRequested.current) return;
        planRequested.current = true;
        mutation.reset();
        createPlan.mutate({ organizationId: organization.id, teamId: team.id });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const created = createPlan.data;
    const ready = created?.status === "ready" ? created : null;

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Sync {team.name} with D4H</DialogTitle>
                    <DialogDescription>Review the changes before applying them.</DialogDescription>
                </DialogHeader>
                <DialogBody>
                    {(createPlan.isIdle || createPlan.isPending) && (
                        <p className="text-sm">Loading preview…</p>
                    )}
                    {createPlan.isError && (
                        <p className="text-destructive text-sm">{createPlan.error.message}</p>
                    )}
                    {created?.status === "in-progress" && (
                        <p className="text-sm">A sync of this team is running.</p>
                    )}
                    {ready && <SyncPlanView plan={ready.plan} />}
                </DialogBody>
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        status={mutation.status}
                        disabled={!ready || isD4HSyncPlanEmpty(ready.plan)}
                        text={{ idle: "Apply", pending: "Applying…", success: "Applied" }}
                        onClick={() =>
                            ready &&
                            mutation.mutate({
                                organizationId: organization.id,
                                planId: ready.planId,
                                skipItemIds: [],
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

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

function itemsOf<K extends D4HSyncItem["kind"]>(plan: D4HSyncPlan, kind: K) {
    return plan.items.filter((i): i is Extract<D4HSyncItem, { kind: K }> => i.kind === kind);
}

function SyncPlanView({ plan }: { plan: D4HSyncPlan }) {
    const skippedGroup = (
        <>
            <Group
                title="Skipped (no email in D4H)"
                rows={plan.skipped.filter((s) => s.reason === "missing-email").map((s) => s.name)}
            />
            <Group
                title="Skipped (email belongs to a person in the Rubbish bin — recover or delete them forever to import)"
                rows={plan.skipped
                    .filter((s) => s.reason === "person-in-rubbish-bin")
                    .map((s) => s.name)}
            />
        </>
    );
    if (isD4HSyncPlanEmpty(plan)) {
        return (
            <div className="space-y-3 text-sm">
                <p className="text-muted-foreground text-sm">Already in sync.</p>
                {skippedGroup}
            </div>
        );
    }
    const metadataChanges = itemsOf(plan, "metadata").flatMap((m) => m.changes);
    return (
        <div className="space-y-3 text-sm">
            <Group
                title="Add"
                rows={itemsOf(plan, "add").map((a) => `${a.personName} (${a.email})`)}
            />
            <Group title="Re-link" rows={itemsOf(plan, "relink").map((r) => r.personName)} />
            <Group title="Update" rows={itemsOf(plan, "update").map((u) => u.personName)} />
            <Group title="Reactivate" rows={itemsOf(plan, "reactivate").map((r) => r.personName)} />
            <Group title="Archive" rows={itemsOf(plan, "archive").map((a) => a.personName)} />
            {metadataChanges.length > 0 && (
                <Group
                    title="Team metadata"
                    rows={[`${metadataChanges.length} field(s) changed`]}
                />
            )}
            {skippedGroup}
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
