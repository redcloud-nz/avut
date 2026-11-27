/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { route } from "@/lib/routes";
import type {
    SelfAuditCampaignId,
    SelfAuditDeliveryStatus,
    SelfAuditStatus,
} from "@/lib/schemas/self-audit";
import { trpc } from "@/trpc/client";

import { D4HI3Module_SelfAuditCampaignAnswers_Dialog } from "./campaign-answers-dialog";
import { describeStatusCounts, STATUS_LABELS } from "./campaign-labels";
import { D4HI3Module_ResendSelfAudit_Dialog } from "./campaign-resend-dialog";

const STATUS_BADGES: Record<
    SelfAuditStatus,
    "success-outline" | "destructive-outline" | "warning-outline" | "info-outline" | "outline"
> = {
    Withdrawn: "outline",
    Submitted: "success-outline",
    Editing: "info-outline",
    Opened: "info-outline",
    Failed: "destructive-outline",
    NoEmail: "warning-outline",
    Sent: "outline",
    Unsent: "outline",
};

const STATUS_ORDER = Object.keys(STATUS_LABELS) as SelfAuditStatus[];

/** A request has a link to resend: it has an email, and its campaign has been sent. */
function isResendable(deliveryStatus: SelfAuditDeliveryStatus): boolean {
    return deliveryStatus !== "NoEmail" && deliveryStatus !== "Unsent";
}

/**
 * A self audit campaign's page: who it went to, whether each email went, and how far each member has got.
 * Hosts the per-request dialogs, `?action=view-answers&requestId=…` and
 * `?action=resend&requestId=…`.
 */
export function D4HI3Module_SelfAuditCampaign_Content({
    campaignId,
}: {
    campaignId: SelfAuditCampaignId;
}) {
    const organization = useOrganization();
    const { formatDateTime } = usePreferences();

    const { data: campaign } = useSuspenseQuery(
        trpc.selfAuditCampaigns.getCampaign.queryOptions({
            organizationId: organization.id,
            campaignId,
        }),
    );

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["view-answers", "resend"] as const),
    );
    const [requestId, setRequestId] = useQueryState("requestId", parseAsString);
    const target = campaign.requests.find((request) => request.id === requestId) ?? null;

    function openRequestAction(next: "view-answers" | "resend", id: string) {
        void setRequestId(id, { history: "push" });
        void setAction(next, { history: "push" });
    }
    function closeRequestAction() {
        void setAction(null, { history: "replace" });
        void setRequestId(null, { history: "replace" });
    }

    type RowData = (typeof campaign.requests)[number];

    const columns = useMemo(() => {
        const timeCell = (value: Date | null) =>
            value ? <time dateTime={value.toISOString()}>{formatDateTime(value)}</time> : "—";

        return Kaga.defineColumns<RowData>((col) => [
            col.accessor("memberName", {
                header: "Member",
                enableColumnFilter: false,
            }),
            col.accessor("email", {
                header: "Email",
                cell: (ctx) => ctx.getValue() ?? "—",
                enableColumnFilter: false,
            }),
            col.accessor("status", {
                header: "Status",
                cell: (ctx) => (
                    <Badge variant={STATUS_BADGES[ctx.getValue()]}>
                        {STATUS_LABELS[ctx.getValue()]}
                    </Badge>
                ),
                enableGlobalFilter: false,
                enableColumnFilter: true,
                filterFn: Kaga.filterFns.oneOf,
                meta: {
                    columnOptions: STATUS_ORDER.map((status) => ({
                        label: STATUS_LABELS[status],
                        value: status,
                    })),
                },
            }),
            col.accessor("sentAt", {
                header: "Sent",
                cell: (ctx) => timeCell(ctx.getValue()),
                enableColumnFilter: false,
                enableGlobalFilter: false,
            }),
            col.accessor("openedAt", {
                header: "Opened",
                cell: (ctx) => timeCell(ctx.getValue()),
                enableColumnFilter: false,
                enableGlobalFilter: false,
            }),
            col.accessor("submittedAt", {
                header: "Submitted",
                cell: (ctx) => timeCell(ctx.getValue()),
                enableColumnFilter: false,
                enableGlobalFilter: false,
            }),
            col.accessor("expiresAt", {
                header: "Expires",
                cell: (ctx) => timeCell(ctx.getValue()),
                enableColumnFilter: false,
                enableGlobalFilter: false,
            }),
            col.display({
                id: "actions",
                header: "",
                cell: (ctx) => (
                    <div className="flex justify-end gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openRequestAction("view-answers", ctx.row.original.id)}
                        >
                            View answers
                        </Button>
                        {isResendable(ctx.row.original.deliveryStatus) && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openRequestAction("resend", ctx.row.original.id)}
                            >
                                Resend
                            </Button>
                        )}
                    </div>
                ),
                enableHiding: false,
            }),
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- openRequestAction only closes over stable nuqs setters
    }, [formatDateTime]);

    const table = useReactTable({
        data: campaign.requests,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        globalFilterFn: "includesString",
        initialState: {
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "memberName", desc: false }],
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Breadcrumbs
                items={[
                    {
                        label: "Self Audit Campaigns",
                        href: route("/orgs/[slug]/d4h-i3/self-audit-campaigns", {
                            slug: organization.slug,
                        }),
                    },
                ]}
            />
            <Saratoga.Header>
                <Saratoga.Title>{campaign.name}</Saratoga.Title>
            </Saratoga.Header>
            <Card>
                <CardContent>
                    <DataList>
                        <DataItem inline>
                            <DataItemTitle>Team</DataItemTitle>
                            <DataItemValue>{campaign.team.name}</DataItemValue>
                        </DataItem>
                        <DataItem inline>
                            <DataItemTitle>Bundle</DataItemTitle>
                            <DataItemValue>{campaign.bundleName}</DataItemValue>
                        </DataItem>
                        <DataItem inline>
                            <DataItemTitle>Sent By</DataItemTitle>
                            <DataItemValue>{campaign.sentByName ?? "—"}</DataItemValue>
                        </DataItem>
                        <DataItem inline>
                            <DataItemTitle>Sent</DataItemTitle>
                            {campaign.sentAt ? (
                                <DataItemDateValue date={campaign.sentAt} />
                            ) : (
                                <DataItemValue>Draft</DataItemValue>
                            )}
                        </DataItem>
                        <DataItem inline>
                            <DataItemTitle>Status</DataItemTitle>
                            <DataItemValue>{describeStatusCounts(campaign.counts)}</DataItemValue>
                        </DataItem>
                    </DataList>
                </CardContent>
            </Card>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>

            {target && (
                <D4HI3Module_SelfAuditCampaignAnswers_Dialog
                    request={target}
                    open={action === "view-answers"}
                    onOpenChange={(open) => (open ? undefined : closeRequestAction())}
                />
            )}
            {target && isResendable(target.deliveryStatus) && (
                <D4HI3Module_ResendSelfAudit_Dialog
                    request={target}
                    open={action === "resend"}
                    onOpenChange={(open) => (open ? undefined : closeRequestAction())}
                />
            )}
        </Saratoga.Root>
    );
}
