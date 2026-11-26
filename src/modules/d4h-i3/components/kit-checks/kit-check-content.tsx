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
import type { KitCheckDeliveryStatus, KitCheckId, KitCheckProgress } from "@/lib/schemas/kit-check";
import { trpc } from "@/trpc/client";

import { D4HI3Module_KitCheckAnswers_Dialog } from "./kit-check-answers-dialog";
import {
    DELIVERY_LABELS,
    describeDeliveryCounts,
    describeProgressCounts,
    PROGRESS_LABELS,
} from "./kit-check-labels";
import { D4HI3Module_ResendKitCheck_Dialog } from "./kit-check-resend-dialog";

const DELIVERY_BADGES: Record<
    KitCheckDeliveryStatus,
    "success-outline" | "destructive-outline" | "warning-outline" | "info-outline"
> = {
    Sent: "success-outline",
    Failed: "destructive-outline",
    NoEmail: "warning-outline",
    Pending: "info-outline",
};

const DELIVERY_ORDER: KitCheckDeliveryStatus[] = ["Sent", "Failed", "NoEmail", "Pending"];
const PROGRESS_ORDER: KitCheckProgress[] = ["NotOpened", "Opened", "Submitted", "Editing"];

/**
 * A kit check's page: who it went to, whether each email went, and how far each member has got.
 * Hosts the per-request dialogs, `?action=view-answers&requestId=…` and
 * `?action=resend&requestId=…`.
 */
export function D4HI3Module_KitCheck_Content({ kitCheckId }: { kitCheckId: KitCheckId }) {
    const organization = useOrganization();
    const { formatDateTime } = usePreferences();

    const { data: kitCheck } = useSuspenseQuery(
        trpc.kitChecks.getKitCheck.queryOptions({ organizationId: organization.id, kitCheckId }),
    );

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["view-answers", "resend"] as const),
    );
    const [requestId, setRequestId] = useQueryState("requestId", parseAsString);
    const target = kitCheck.requests.find((request) => request.id === requestId) ?? null;

    function openRequestAction(next: "view-answers" | "resend", id: string) {
        void setRequestId(id, { history: "push" });
        void setAction(next, { history: "push" });
    }
    function closeRequestAction() {
        void setAction(null, { history: "replace" });
        void setRequestId(null, { history: "replace" });
    }

    type RowData = (typeof kitCheck.requests)[number];

    const columns = useMemo(() => {
        const timeCell = (value: Date | null) =>
            value ? <time dateTime={value.toISOString()}>{formatDateTime(value)}</time> : "—";

        return Kaga.defineColumns<RowData>((col) => [
            col.accessor("memberName", {
                header: "Member",
                enableColumnFilter: false,
            }),
            col.accessor("d4hTeamTitle", {
                header: "Team",
                enableColumnFilter: true,
                filterFn: Kaga.filterFns.oneOf,
                meta: {
                    columnOptions: kitCheck.d4hTeams.map((team) => ({
                        label: team.title,
                        value: team.title,
                    })),
                },
            }),
            col.accessor("email", {
                header: "Email",
                cell: (ctx) => ctx.getValue() ?? "—",
                enableColumnFilter: false,
            }),
            col.accessor("deliveryStatus", {
                header: "Delivery",
                cell: (ctx) => (
                    <Badge variant={DELIVERY_BADGES[ctx.getValue()]}>
                        {DELIVERY_LABELS[ctx.getValue()]}
                    </Badge>
                ),
                enableGlobalFilter: false,
                enableColumnFilter: true,
                filterFn: Kaga.filterFns.oneOf,
                meta: {
                    columnOptions: DELIVERY_ORDER.map((status) => ({
                        label: DELIVERY_LABELS[status],
                        value: status,
                    })),
                },
            }),
            col.accessor("progress", {
                header: "Progress",
                cell: (ctx) => {
                    const { progress, submittedAt } = ctx.row.original;
                    // Reopened: the last submitted answers stand until they submit again.
                    if (progress === "Editing" && submittedAt) {
                        return (
                            <>
                                Editing{" "}
                                <span className="text-muted-foreground">
                                    (submitted {formatDateTime(submittedAt)})
                                </span>
                            </>
                        );
                    }
                    return PROGRESS_LABELS[progress];
                },
                enableGlobalFilter: false,
                enableColumnFilter: true,
                filterFn: Kaga.filterFns.oneOf,
                meta: {
                    columnOptions: PROGRESS_ORDER.map((progress) => ({
                        label: PROGRESS_LABELS[progress],
                        value: progress,
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
                        {ctx.row.original.deliveryStatus !== "NoEmail" && (
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
    }, [formatDateTime, kitCheck.d4hTeams]);

    const table = useReactTable({
        data: kitCheck.requests,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        globalFilterFn: "includesString",
        initialState: {
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [
                { id: "d4hTeamTitle", desc: false },
                { id: "memberName", desc: false },
            ],
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Breadcrumbs
                items={[
                    {
                        label: "Kit Checks",
                        href: route("/orgs/[slug]/d4h-i3/kit-checks", { slug: organization.slug }),
                    },
                ]}
            />
            <Saratoga.Header>
                <Saratoga.Title>{kitCheck.bundleName}</Saratoga.Title>
            </Saratoga.Header>
            <Card>
                <CardContent>
                    <DataList>
                        <DataItem inline>
                            <DataItemTitle>Teams</DataItemTitle>
                            <DataItemValue>
                                {kitCheck.d4hTeams.map((team) => team.title).join(", ")}
                            </DataItemValue>
                        </DataItem>
                        <DataItem inline>
                            <DataItemTitle>Sent By</DataItemTitle>
                            <DataItemValue>{kitCheck.sentByName ?? "—"}</DataItemValue>
                        </DataItem>
                        <DataItem inline>
                            <DataItemTitle>Sent</DataItemTitle>
                            <DataItemDateValue date={kitCheck.createdAt} />
                        </DataItem>
                        <DataItem inline>
                            <DataItemTitle>Delivery</DataItemTitle>
                            <DataItemValue>
                                {describeDeliveryCounts(kitCheck.counts.delivery)}
                            </DataItemValue>
                        </DataItem>
                        <DataItem inline>
                            <DataItemTitle>Progress</DataItemTitle>
                            <DataItemValue>
                                {describeProgressCounts(kitCheck.counts.progress)}
                            </DataItemValue>
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
                <D4HI3Module_KitCheckAnswers_Dialog
                    request={target}
                    open={action === "view-answers"}
                    onOpenChange={(open) => (open ? undefined : closeRequestAction())}
                />
            )}
            {target && target.deliveryStatus !== "NoEmail" && (
                <D4HI3Module_ResendKitCheck_Dialog
                    request={target}
                    open={action === "resend"}
                    onOpenChange={(open) => (open ? undefined : closeRequestAction())}
                />
            )}
        </Saratoga.Root>
    );
}
