/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Protect } from "@/components/protect";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { DL, DLDateDetails, DLDetails, DLTerm } from "@/components/ui/description-list";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import { teamsEffects } from "@/client/teams-effects";
import { useOrganization } from "@/hooks/use-organization";
import { getD4HServer } from "@/lib/d4h-servers";
import { SyncPlan, isSyncPlanEmpty } from "@/lib/schemas/d4h-sync-plan";
import { TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

const ACTIONS = ["d4h-link", "d4h-sync"] as const;

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
                    <CardAction>
                        {team.d4h ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void setAction("d4h-sync", { history: "push" })}
                            >
                                Sync…
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void setAction("d4h-link", { history: "push" })}
                            >
                                Link to D4H…
                            </Button>
                        )}
                    </CardAction>
                </CardHeader>
                <CardContent>
                    {team.d4h ? (
                        <DL>
                            <DLTerm>D4H Team</DLTerm>
                            <DLDetails>
                                {team.d4h.d4hTeamName}{" "}
                                <span className="text-muted-foreground">#{team.d4h.d4hTeamId}</span>
                            </DLDetails>
                            <DLTerm>Server</DLTerm>
                            <DLDetails>{getD4HServer(team.d4h.d4hServerCode).name}</DLDetails>
                            <DLTerm>D4H Organisation</DLTerm>
                            <DLDetails>
                                {team.d4h.d4hOrganisationId
                                    ? `#${team.d4h.d4hOrganisationId}`
                                    : "None (org-less team)"}
                            </DLDetails>
                            <DLTerm>Last synced</DLTerm>
                            {team.d4h.lastSyncedAt ? (
                                <DLDateDetails date={team.d4h.lastSyncedAt} />
                            ) : (
                                <DLDetails>Never</DLDetails>
                            )}
                        </DL>
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
            {team.d4h && <UnlinkButton team={team} />}
        </Protect>
    );
}

function UnlinkButton({ team }: { team: TeamData }) {
    const organization = useOrganization();
    const [confirming, setConfirming] = useState(false);

    const mutation = useMutation(
        trpc.teams.unlinkTeamFromD4H.mutationOptions({
            meta: { effects: teamsEffects.unlinkTeamFromD4H },
            onError: (error) => toast.error(`Failed to unlink: ${error.message}`),
            onSuccess: () => {
                toast.success("Unlinked from D4H");
                setConfirming(false);
            },
        }),
    );

    return (
        <div className="mt-2">
            {confirming ? (
                <div className="flex items-center gap-2">
                    <span className="text-sm">Unlink this team from D4H?</span>
                    <MutationButton
                        size="sm"
                        variant="destructive"
                        status={mutation.status}
                        text={{ idle: "Unlink", pending: "Unlinking…", success: "Unlinked" }}
                        onClick={() =>
                            mutation.mutate({ organizationId: organization.id, teamId: team.id })
                        }
                    />
                    <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                        Cancel
                    </Button>
                </div>
            ) : (
                <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
                    Unlink from D4H
                </Button>
            )}
        </div>
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
    const organization = useOrganization();
    const [d4hTeamId, setD4hTeamId] = useState<number | null>(null);

    const { data: availableTeams = [] } = useQuery(
        trpc.d4hApi.listTeamsAccessibleToUser.queryOptions(
            { organizationId: organization.id },
            { enabled: open },
        ),
    );

    const mutation = useMutation(
        trpc.teams.linkTeamToD4H.mutationOptions({
            meta: { effects: teamsEffects.linkTeamToD4H },
            onError: (error) => toast.error(error.message),
            onSuccess: ({ plan }) => {
                toast.success(`Linked to D4H — ${plan.counts.additions} member(s) imported`);
                onClose();
            },
        }),
    );

    useEffect(() => {
        if (open) {
            setD4hTeamId(null);
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Link {team.name} to D4H</DialogTitle>
                    <DialogDescription>
                        Choose a D4H team visible to your personal access token. Its members will be
                        imported and kept in sync on demand.
                    </DialogDescription>
                </DialogHeader>
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
            </DialogContent>
        </Dialog>
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
    const queryClient = useQueryClient();

    const planQuery = useQuery(
        trpc.teams.planD4HTeamSync.queryOptions(
            { organizationId: organization.id, teamId: team.id },
            { enabled: open, staleTime: 0 },
        ),
    );

    const [staleNotice, setStaleNotice] = useState(false);

    const mutation = useMutation(
        trpc.teams.applyD4HTeamSync.mutationOptions({
            meta: { effects: teamsEffects.applyD4HTeamSync },
            onError: (error) => {
                if (error.shape?.cause?.name === "StalePlanError") {
                    setStaleNotice(true);
                    void queryClient.invalidateQueries(
                        trpc.teams.planD4HTeamSync.queryFilter({
                            organizationId: organization.id,
                            teamId: team.id,
                        }),
                    );
                } else {
                    toast.error(`Sync failed: ${error.message}`);
                }
            },
            onSuccess: ({ plan }) => {
                toast.success(
                    `Synced: +${plan.counts.additions} ~${plan.counts.updates} ` +
                        `archived ${plan.counts.archivals} reactivated ${plan.counts.reactivations}`,
                );
                onClose();
            },
        }),
    );

    useEffect(() => {
        if (open) {
            setStaleNotice(false);
            mutation.reset();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const plan = planQuery.data;

    return (
        <Dialog open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Sync {team.name} with D4H</DialogTitle>
                    <DialogDescription>Review the changes before applying them.</DialogDescription>
                </DialogHeader>

                {staleNotice && (
                    <p className="rounded bg-amber-100 p-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        The D4H data changed since this preview loaded. Review the updated changes
                        below and apply again.
                    </p>
                )}

                {planQuery.isLoading && <p className="text-sm">Loading preview…</p>}
                {planQuery.isError && (
                    <p className="text-destructive text-sm">{planQuery.error.message}</p>
                )}
                {plan && <SyncPlanView plan={plan} />}

                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        status={mutation.status}
                        disabled={!plan || isSyncPlanEmpty(plan)}
                        text={{ idle: "Apply", pending: "Applying…", success: "Applied" }}
                        onClick={() =>
                            plan &&
                            mutation.mutate({
                                organizationId: organization.id,
                                teamId: team.id,
                                planToken: plan.planToken,
                            })
                        }
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SyncPlanView({ plan }: { plan: SyncPlan }) {
    if (isSyncPlanEmpty(plan)) {
        return <p className="text-muted-foreground text-sm">Already in sync.</p>;
    }
    return (
        <div className="space-y-3 text-sm">
            <Group title="Add" rows={plan.additions.map((a) => `${a.name} (${a.email})`)} />
            <Group title="Update" rows={plan.updates.map((u) => u.personName)} />
            <Group title="Reactivate" rows={plan.reactivations.map((r) => r.personName)} />
            <Group title="Archive" rows={plan.archivals.map((a) => a.personName)} />
            {plan.teamMetadataChanges.length > 0 && (
                <Group
                    title="Team metadata"
                    rows={[`${plan.teamMetadataChanges.length} field(s) changed`]}
                />
            )}
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
