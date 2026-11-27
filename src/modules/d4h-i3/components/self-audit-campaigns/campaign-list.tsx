/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
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
import { TeamLink } from "@/components/entity-links/team-link";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

import { describeSubmitted } from "./campaign-labels";
import { D4HI3Module_CreateSelfAuditCampaign_Dialog } from "./create-campaign-dialog";

/** The organization's self audit campaigns, newest first. A top-level page of the module, so no trail. */
export function D4HI3Module_SelfAuditCampaignList() {
    const organization = useOrganization();
    const { formatDateTime } = usePreferences();

    const { data: selfAuditCampaigns } = useSuspenseQuery(
        trpc.selfAuditCampaigns.listCampaigns.queryOptions({ organizationId: organization.id }),
    );

    type RowData = (typeof selfAuditCampaigns)[number];

    const columns = useMemo(
        () =>
            Kaga.defineColumns<RowData>((col) => [
                col.accessor("name", {
                    header: "Name",
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/d4h-i3/self-audit-campaigns/[campaign_id]", {
                                slug: organization.slug,
                                campaign_id: ctx.row.original.id,
                            })}
                            className="hover:underline"
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableColumnFilter: false,
                }),
                col.accessor((row) => row.team.name, {
                    id: "team",
                    header: "Team",
                    cell: (ctx) => <TeamLink team={ctx.row.original.team} />,
                    enableColumnFilter: false,
                }),
                col.accessor((row) => (row.sentAt ? "Sent" : "Draft"), {
                    id: "status",
                    header: "Status",
                    cell: (ctx) =>
                        ctx.getValue() === "Sent" ? (
                            <Badge variant="secondary">Sent</Badge>
                        ) : (
                            <Badge variant="outline">Draft</Badge>
                        ),
                    enableColumnFilter: false,
                }),
                col.accessor("sentAt", {
                    header: "Sent",
                    cell: (ctx) => {
                        const sentAt = ctx.getValue();
                        return sentAt ? (
                            <time dateTime={sentAt.toISOString()}>{formatDateTime(sentAt)}</time>
                        ) : (
                            "—"
                        );
                    },
                    enableColumnFilter: false,
                    enableGlobalFilter: false,
                }),
                col.display({
                    id: "submitted",
                    header: "Submitted",
                    cell: (ctx) => describeSubmitted(ctx.row.original.counts),
                }),
            ]),
        [formatDateTime, organization.slug],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: selfAuditCampaigns,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Self Audit Campaigns</Saratoga.Title>
                <Saratoga.Actions>
                    <D4HI3Module_CreateSelfAuditCampaign_Dialog />
                </Saratoga.Actions>
            </Saratoga.Header>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>
        </Saratoga.Root>
    );
}
