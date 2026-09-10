/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect } from "react";
import { toast } from "sonner";

import { useMutation, useQuery } from "@tanstack/react-query";

import { D4HIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button, MutationButton } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDateDetails, DLDetails, DLTerm } from "@/components/ui/description-list";
import {
    Dialog,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { teamsEffects } from "@/client/teams-effects";
import { useOrganization } from "@/hooks/use-organization";
import { getD4HServer } from "@/lib/d4h-servers";
import { OrganizationD4HData } from "@/lib/schemas/organization-d4h";
import { trpc } from "@/trpc/client";

const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

function formatReportingStart(day: number | null, month: number | null): string | null {
    if (day == null || month == null) return null;
    const name = MONTHS[month - 1];
    return name ? `${day} ${name}` : null;
}

export function AdminModule_Organization_D4HCard() {
    const organization = useOrganization();

    const { data: orgD4H } = useQuery(
        trpc.teams.getOrganizationD4H.queryOptions({ organizationId: organization.id }),
    );

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["d4h-org-unlink"] as const),
    );

    if (!organization.settings.integrations.d4h.enabled || !orgD4H) return null;

    const reportingStart = formatReportingStart(
        orgD4H.d4hReportingStartDay,
        orgD4H.d4hReportingStartMonth,
    );

    return (
        <Protect permissions={{ organization: ["update"] }}>
            <Card>
                <CardHeader>
                    <CardTitle>D4H Integration</CardTitle>
                    <CardAction>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={orgD4H.linkedTeamCount > 0}
                            title={
                                orgD4H.linkedTeamCount > 0
                                    ? "Unlink all D4H-linked teams first"
                                    : undefined
                            }
                            onClick={() => void setAction("d4h-org-unlink", { history: "push" })}
                        >
                            <D4HIcons.Unlink /> Unlink
                        </Button>
                    </CardAction>
                </CardHeader>
                <CardContent>
                    <DL>
                        <DLTerm>D4H Organisation</DLTerm>
                        <DLDetails>
                            {orgD4H.d4hOrganisationId ? (
                                <>
                                    {orgD4H.d4hOrganisationName}
                                    {orgD4H.d4hOrganisationName && " "}
                                    <span className="text-muted-foreground">
                                        (ID: {orgD4H.d4hOrganisationId})
                                    </span>
                                </>
                            ) : (
                                "Org-less (no D4H organisation)"
                            )}
                        </DLDetails>
                        <DLTerm>Server</DLTerm>
                        <DLDetails>{getD4HServer(orgD4H.serverCode).name}</DLDetails>
                        {orgD4H.d4hTimezone && (
                            <>
                                <DLTerm>Timezone</DLTerm>
                                <DLDetails>{orgD4H.d4hTimezone}</DLDetails>
                            </>
                        )}
                        {orgD4H.d4hCurrency && (
                            <>
                                <DLTerm>Currency</DLTerm>
                                <DLDetails>{orgD4H.d4hCurrency}</DLDetails>
                            </>
                        )}
                        {reportingStart && (
                            <>
                                <DLTerm>Reporting year starts</DLTerm>
                                <DLDetails>{reportingStart}</DLDetails>
                            </>
                        )}
                        <DLTerm>Linked teams</DLTerm>
                        <DLDetails>{orgD4H.linkedTeamCount}</DLDetails>
                        <DLTerm>Last synced</DLTerm>
                        {orgD4H.lastSyncedAt ? (
                            <DLDateDetails date={orgD4H.lastSyncedAt} />
                        ) : (
                            <DLDetails>Never</DLDetails>
                        )}
                    </DL>
                </CardContent>
            </Card>

            <UnlinkDialog
                orgD4H={orgD4H}
                open={action === "d4h-org-unlink"}
                onClose={() => void setAction(null, { history: "replace" })}
            />
        </Protect>
    );
}

function UnlinkDialog({
    orgD4H,
    open,
    onClose,
}: {
    orgD4H: OrganizationD4HData;
    open: boolean;
    onClose: () => void;
}) {
    const organization = useOrganization();

    const mutation = useMutation(
        trpc.teams.unlinkOrganizationFromD4H.mutationOptions({
            meta: { effects: teamsEffects.unlinkOrganizationFromD4H },
            onError: (error) => toast.error(`Failed to unlink: ${error.message}`),
            onSuccess: () => {
                toast.success("Organisation unlinked from D4H");
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
                    <DialogTitle>Unlink {organization.name} from D4H</DialogTitle>
                    <DialogDescription>
                        Removes the org-level D4H link and its cached organisation data. Personnel,
                        teams and memberships stay in AVUT. You can re-link later by linking a team
                        to D4H.
                    </DialogDescription>
                </DialogHeader>
                {orgD4H.linkedTeamCount > 0 && (
                    <p className="text-destructive text-sm">
                        {orgD4H.linkedTeamCount} team(s) are still linked to D4H. Unlink them first.
                    </p>
                )}
                <DialogFooter>
                    <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                    <MutationButton
                        variant="destructive"
                        status={mutation.status}
                        disabled={orgD4H.linkedTeamCount > 0}
                        text={{ idle: "Unlink", pending: "Unlinking…", success: "Unlinked" }}
                        onClick={() => mutation.mutate({ organizationId: organization.id })}
                    />
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
