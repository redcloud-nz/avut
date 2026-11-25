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
import { ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

/** Joins the non-zero counts as "3 sent, 1 failed", or "—" when every count is zero. */
function describeCounts(parts: [count: number, label: string][]): string {
    const shown = parts.filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}`);
    return shown.length > 0 ? shown.join(", ") : "—";
}

/** The organization's kit checks, newest first. A top-level page of the module, so no trail. */
export function D4HI3Module_KitCheckList() {
    const organization = useOrganization();
    const { formatDateTime } = usePreferences();

    const { data: kitChecks } = useSuspenseQuery(
        trpc.kitChecks.listKitChecks.queryOptions({ organizationId: organization.id }),
    );

    type RowData = (typeof kitChecks)[number];

    const columns = useMemo(
        () =>
            Kaga.defineColumns<RowData>((col) => [
                col.accessor("bundleName", {
                    header: "Bundle",
                    enableColumnFilter: false,
                }),
                col.accessor((row) => row.d4hTeams.map((team) => team.title).join(", "), {
                    id: "teams",
                    header: "Teams",
                    enableColumnFilter: false,
                    enableSorting: false,
                }),
                col.accessor("sentByName", {
                    header: "Sent By",
                    cell: (ctx) => ctx.getValue() ?? "—",
                    enableColumnFilter: false,
                }),
                col.accessor("createdAt", {
                    header: "Sent",
                    cell: (ctx) => (
                        <time dateTime={ctx.getValue().toISOString()}>
                            {formatDateTime(ctx.getValue())}
                        </time>
                    ),
                    enableColumnFilter: false,
                    enableGlobalFilter: false,
                }),
                col.display({
                    id: "delivery",
                    header: "Delivery",
                    cell: (ctx) => {
                        const { Sent, Failed, NoEmail, Pending } = ctx.row.original.counts.delivery;
                        return describeCounts([
                            [Sent, "sent"],
                            [Failed, "failed"],
                            [NoEmail, "no email"],
                            [Pending, "sending"],
                        ]);
                    },
                }),
                col.display({
                    id: "progress",
                    header: "Progress",
                    cell: (ctx) => {
                        const { Submitted, Editing, Opened, NotOpened } =
                            ctx.row.original.counts.progress;
                        return describeCounts([
                            [Submitted, "submitted"],
                            [Editing, "editing"],
                            [Opened, "opened"],
                            [NotOpened, "not opened"],
                        ]);
                    },
                }),
            ]),
        [formatDateTime],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: kitChecks,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "createdAt", desc: true }],
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Kit Checks</Saratoga.Title>
                <Saratoga.Actions>
                    <Button variant="outline" asChild>
                        <Link
                            href={route("/orgs/[slug]/d4h-i3/kit-checks/new", {
                                slug: organization.slug,
                            })}
                        >
                            <ObjectIcons.Create />{" "}
                            <span className="sr-only md:not-sr-only">New Kit Check</span>
                        </Link>
                    </Button>
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
