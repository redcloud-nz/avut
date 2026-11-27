/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useEffect, useMemo } from "react";

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
import { ClientOnly } from "@/components/client-only";
import { TeamLink } from "@/components/entity-links/team-link";
import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { route } from "@/lib/routes";
import type {
    SelfAuditCampaignId,
    SelfAuditDeliveryStatus,
    SelfAuditStatus,
} from "@/lib/schemas/self-audit";
import { trpc } from "@/trpc/client";

import { D4HI3Module_AddSelfAuditMembers_Dialog } from "./add-members-dialog";
import { STATUS_BADGES, STATUS_LABELS, STATUS_ORDER } from "./campaign-labels";
import { D4HI3Module_SelfAuditCampaignMember_Dialog } from "./campaign-member-dialog";
import { D4HI3Module_ResendSelfAudit_Dialog } from "./campaign-resend-dialog";
import { D4HI3Module_SelfAuditCampaign_StatusStrip } from "./campaign-status-strip";
import { D4HI3Module_DiscardSelfAuditCampaign_Dialog } from "./discard-campaign-dialog";
import { D4HI3Module_ReaddSelfAuditRequest_Dialog } from "./readd-request-dialog";
import { D4HI3Module_RemoveSelfAuditRequest_Dialog } from "./remove-request-dialog";
import { D4HI3Module_SendSelfAuditCampaign_Dialog } from "./send-campaign-dialog";
import { D4HI3Module_WithdrawSelfAuditRequest_Dialog } from "./withdraw-request-dialog";

type RequestAction = "view-answers" | "resend" | "remove" | "withdraw" | "re-add";
type PageAction = "add-members" | "send" | "discard";

/**
 * A request whose link can be resent: it was sent (or tried), and isn't withdrawn. Read from the
 * delivery status rather than the merged one, which shows progress (Opened, Submitted) over it.
 */
function isResendable(request: {
    deliveryStatus: SelfAuditDeliveryStatus;
    withdrawnAt: Date | null;
}): boolean {
    return (
        (request.deliveryStatus === "Pending" ||
            request.deliveryStatus === "Sent" ||
            request.deliveryStatus === "Failed") &&
        request.withdrawnAt === null
    );
}

/** A member of a sent campaign who can be withdrawn: anyone not withdrawn already. */
function isWithdrawable(request: { status: SelfAuditStatus }): boolean {
    return request.status !== "Withdrawn";
}

/** A withdrawn member, who can be re-added with a fresh link. */
function isReaddable(request: { status: SelfAuditStatus }): boolean {
    return request.status === "Withdrawn";
}

/** A withdrawn member's row text reads dimmed. */
function dimIfWithdrawn(request: { status: SelfAuditStatus }): string | undefined {
    return request.status === "Withdrawn" ? "text-muted-foreground" : undefined;
}

/** The latest thing that happened to a request: sent, opened, submitted or withdrawn. */
function lastActivityOf(request: {
    sentAt: Date | null;
    openedAt: Date | null;
    submittedAt: Date | null;
    withdrawnAt: Date | null;
}): { label: string; date: Date } | null {
    const events = [
        { label: "Sent", date: request.sentAt },
        { label: "Opened", date: request.openedAt },
        { label: "Submitted", date: request.submittedAt },
        { label: "Withdrawn", date: request.withdrawnAt },
    ].filter((event): event is { label: string; date: Date } => event.date !== null);
    return events.reduce<{ label: string; date: Date } | null>(
        (latest, event) => (latest === null || event.date > latest.date ? event : latest),
        null,
    );
}

/**
 * A self audit campaign's page: the campaign's record, its members by status, and the members
 * table, which the status strip filters. Hosts the page's dialogs, `?action=add-members` and, on a
 * Draft, `?action=send` and `?action=discard`, and the per-request ones, `?action=…&requestId=…`:
 * `view-answers` and, as the member's state allows, `resend`, `remove` (Draft), `withdraw` (sent)
 * and `re-add` (withdrawn).
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
        parseAsStringLiteral([
            "view-answers",
            "resend",
            "remove",
            "withdraw",
            "re-add",
            "add-members",
            "send",
            "discard",
        ] as const),
    );
    const [requestId, setRequestId] = useQueryState("requestId", parseAsString);
    const target = campaign.requests.find((request) => request.id === requestId) ?? null;

    function openRequestAction(next: RequestAction, id: string) {
        void setRequestId(id, { history: "push" });
        void setAction(next, { history: "push" });
    }
    function closeRequestAction() {
        void setAction(null, { history: "replace" });
        void setRequestId(null, { history: "replace" });
    }
    function handlePageActionOpenChange(next: PageAction, open: boolean) {
        void setAction(open ? next : null, { history: open ? "push" : "replace" });
    }

    const isDraft = campaign.sentAt === null;
    // A send tries every member of a Draft: `NoEmail` ones are checked against D4H again.
    const sendCount = campaign.counts.Unsent + campaign.counts.NoEmail;

    // A param whose dialog can't open (a stale link, a back navigation, or the action's own
    // success) is cleared, so it can't open the dialog later when the state comes round again.
    const strandedAction =
        (action === "send" && !isDraft) ||
        (action === "withdraw" && !(target && !isDraft && isWithdrawable(target))) ||
        (action === "re-add" && !(target && !isDraft && isReaddable(target)));
    useEffect(() => {
        if (!strandedAction) return;
        if (action === "send") handlePageActionOpenChange("send", false);
        else closeRequestAction();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when a param becomes stranded
    }, [strandedAction]);

    type RowData = (typeof campaign.requests)[number];

    const columns = useMemo(
        () =>
            Kaga.defineColumns<RowData>((col) => [
                col.accessor("memberName", {
                    header: "Member",
                    // A withdrawn member reads dimmed, here and in Last Activity.
                    cell: (ctx) => (
                        <span className={dimIfWithdrawn(ctx.row.original)}>{ctx.getValue()}</span>
                    ),
                    enableColumnFilter: false,
                }),
                col.accessor("status", {
                    header: "Status",
                    cell: (ctx) => (
                        <Badge variant={STATUS_BADGES[ctx.getValue()]}>
                            {STATUS_LABELS[ctx.getValue()]}
                        </Badge>
                    ),
                    sortingFn: (a, b) =>
                        STATUS_ORDER.indexOf(a.original.status) -
                        STATUS_ORDER.indexOf(b.original.status),
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
                col.accessor((request) => lastActivityOf(request)?.date.getTime() ?? 0, {
                    id: "lastActivity",
                    header: "Last Activity",
                    cell: (ctx) => {
                        const activity = lastActivityOf(ctx.row.original);
                        if (!activity) return "—";
                        return (
                            <time
                                dateTime={activity.date.toISOString()}
                                title={formatDateTime(activity.date)}
                                className={dimIfWithdrawn(ctx.row.original)}
                            >
                                {activity.label}{" "}
                                <ClientOnly fallback={null}>
                                    <RelativeTime date={activity.date} />
                                </ClientOnly>
                            </time>
                        );
                    },
                    enableColumnFilter: false,
                    enableGlobalFilter: false,
                }),
                col.display({
                    id: "actions",
                    header: "",
                    cell: (ctx) => (
                        <div className="flex justify-end">
                            <RequestMenu
                                request={ctx.row.original}
                                isDraft={isDraft}
                                onAction={(next) => openRequestAction(next, ctx.row.original.id)}
                            />
                        </div>
                    ),
                    enableHiding: false,
                }),
            ]),
        // eslint-disable-next-line react-hooks/exhaustive-deps -- openRequestAction only closes over stable nuqs setters
        [formatDateTime, isDraft],
    );

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

    // A tile is active when the Status filter holds its status alone.
    const statusColumn = table.getColumn("status");
    const statusFilter = statusColumn?.getFilterValue();
    const activeStatus =
        Array.isArray(statusFilter) && statusFilter.length === 1
            ? (statusFilter[0] as SelfAuditStatus)
            : null;

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
                <Saratoga.Actions>
                    {isDraft && (
                        <Button
                            variant="destructive"
                            onClick={() => handlePageActionOpenChange("discard", true)}
                        >
                            <ObjectIcons.Delete />
                            <span className="sr-only md:not-sr-only">Discard draft</span>
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => handlePageActionOpenChange("add-members", true)}
                    >
                        <ObjectIcons.Create />
                        <span className="sr-only md:not-sr-only">Add members</span>
                    </Button>
                    {isDraft && (
                        <Button
                            disabled={sendCount === 0}
                            onClick={() => handlePageActionOpenChange("send", true)}
                        >
                            <ObjectIcons.Invite /> Send to {sendCount}
                        </Button>
                    )}
                </Saratoga.Actions>
            </Saratoga.Header>
            <RecordCard label="Self Audit Campaign" updatedAt={campaign.updatedAt}>
                <CardContent>
                    <DataList>
                        <RecordCardId label="ID" id={campaign.id} />
                        <DataItem>
                            <DataItemTitle>Name</DataItemTitle>
                            <DataItemValue>{campaign.name}</DataItemValue>
                        </DataItem>
                        <DataItem>
                            <DataItemTitle>Team</DataItemTitle>
                            <DataItemValue>
                                <TeamLink team={campaign.team} />
                            </DataItemValue>
                        </DataItem>
                        <DataItem>
                            <DataItemTitle>Bundle</DataItemTitle>
                            <DataItemValue>{campaign.bundleName}</DataItemValue>
                        </DataItem>
                        <DataItem>
                            <DataItemTitle>Sent</DataItemTitle>
                            <DataItemValue>
                                {campaign.sentAt ? (
                                    <>
                                        <time
                                            dateTime={campaign.sentAt.toISOString()}
                                            className="block"
                                        >
                                            {formatDateTime(campaign.sentAt)}
                                        </time>
                                        {campaign.sentByName && (
                                            <span className="text-muted-foreground">
                                                by {campaign.sentByName}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    "Draft"
                                )}
                            </DataItemValue>
                        </DataItem>
                    </DataList>
                </CardContent>
            </RecordCard>
            <D4HI3Module_SelfAuditCampaign_StatusStrip
                counts={campaign.counts}
                activeStatus={activeStatus}
                onSelect={(status) => {
                    statusColumn?.setFilterValue(status ? [status] : undefined);
                    table.setPageIndex(0);
                }}
            />
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>

            <D4HI3Module_AddSelfAuditMembers_Dialog
                campaign={campaign}
                open={action === "add-members"}
                onOpenChange={(open) => handlePageActionOpenChange("add-members", open)}
            />
            {/* Mounted on a sent campaign too, so it outlives the send that ends the Draft. */}
            <D4HI3Module_SendSelfAuditCampaign_Dialog
                campaign={{
                    id: campaign.id,
                    name: campaign.name,
                    memberCount: sendCount,
                    noEmailCount: campaign.counts.NoEmail,
                }}
                open={action === "send" && isDraft}
                onOpenChange={(open) => handlePageActionOpenChange("send", open)}
            />
            {isDraft && (
                <D4HI3Module_DiscardSelfAuditCampaign_Dialog
                    campaign={campaign}
                    open={action === "discard"}
                    onOpenChange={(open) => handlePageActionOpenChange("discard", open)}
                />
            )}
            {target && (
                <D4HI3Module_SelfAuditCampaignMember_Dialog
                    request={target}
                    open={action === "view-answers"}
                    onOpenChange={(open) => (open ? undefined : closeRequestAction())}
                />
            )}
            {target && isResendable(target) && (
                <D4HI3Module_ResendSelfAudit_Dialog
                    request={target}
                    open={action === "resend"}
                    onOpenChange={(open) => (open ? undefined : closeRequestAction())}
                />
            )}
            {target && isDraft && (
                <D4HI3Module_RemoveSelfAuditRequest_Dialog
                    request={target}
                    open={action === "remove"}
                    onOpenChange={(open) => (open ? undefined : closeRequestAction())}
                />
            )}
            {/* Withdraw and re-add stay mounted as the member's status flips, so their close
                outlives the refetch. */}
            {target && !isDraft && (
                <D4HI3Module_WithdrawSelfAuditRequest_Dialog
                    request={target}
                    open={action === "withdraw" && isWithdrawable(target)}
                    onOpenChange={(open) => (open ? undefined : closeRequestAction())}
                />
            )}
            {target && !isDraft && (
                <D4HI3Module_ReaddSelfAuditRequest_Dialog
                    campaignId={campaign.id}
                    request={target}
                    open={action === "re-add" && isReaddable(target)}
                    onOpenChange={(open) => (open ? undefined : closeRequestAction())}
                />
            )}
        </Saratoga.Root>
    );
}

/** A member row's ⋮ menu: the actions that open the page's per-request dialogs. */
function RequestMenu({
    request,
    isDraft,
    onAction,
}: {
    request: {
        memberName: string;
        status: SelfAuditStatus;
        deliveryStatus: SelfAuditDeliveryStatus;
        withdrawnAt: Date | null;
    };
    isDraft: boolean;
    onAction: (action: RequestAction) => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Actions for ${request.memberName}`}
                >
                    <DropdownMenuTriggerIcon />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => onAction("view-answers")}>
                        View
                    </DropdownMenuItem>
                    {isResendable(request) && (
                        <DropdownMenuItem onClick={() => onAction("resend")}>
                            Resend
                        </DropdownMenuItem>
                    )}
                    {isReaddable(request) && (
                        <DropdownMenuItem onClick={() => onAction("re-add")}>
                            Re-add
                        </DropdownMenuItem>
                    )}
                </DropdownMenuGroup>
                {isDraft && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => onAction("remove")}>
                            Remove
                        </DropdownMenuItem>
                    </>
                )}
                {!isDraft && isWithdrawable(request) && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onAction("withdraw")}
                        >
                            Withdraw
                        </DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** A component, not an inline call, so the server never reads the clock at all. */
function RelativeTime({ date }: { date: Date }) {
    const { formatRelativeDateTime } = usePreferences();
    return formatRelativeDateTime(date);
}
