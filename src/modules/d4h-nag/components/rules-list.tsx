/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

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
import { Protect } from "@/components/protect";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import type { D4HNagRuleListItem } from "@/lib/schemas/d4h-nag";
import { describePausedReason } from "@/modules/d4h-nag/lib/paused-reason";
import { trpc } from "@/trpc/client";

import { D4HNag_CreateRule_Dialog } from "./create-rule-dialog";

/** The rule's look-ahead in words, e.g. "Next 24 hours". */
function describeWindow(lookAheadHours: number): string {
    return lookAheadHours === 1 ? "Next hour" : `Next ${lookAheadHours} hours`;
}

/** The organization's reminder rules. */
export function D4HNag_Rules_List() {
    const organization = useOrganization();
    const { formatRelativeDateTime } = usePreferences();

    const { data: rules } = useSuspenseQuery(
        trpc.d4hNag.listRules.queryOptions({ organizationId: organization.id }),
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<D4HNagRuleListItem>((columnHelper) => [
                columnHelper.accessor((row) => row.team.name, {
                    id: "team",
                    header: "Team",
                    cell: (ctx) => <TeamLink team={ctx.row.original.team} />,
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("schedule", {
                    header: "When",
                    cell: (ctx) => ctx.getValue(),
                    // Week order (Sunday first, as `weekday` counts), then hour.
                    sortingFn: (a, b) =>
                        a.original.weekday - b.original.weekday ||
                        a.original.hour - b.original.hour,
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("lookAheadHours", {
                    header: "Window",
                    cell: (ctx) => describeWindow(ctx.getValue()),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor(
                    (row) =>
                        row.pausedReason ? describePausedReason(row.pausedReason).label : "Enabled",
                    {
                        id: "status",
                        header: "Status",
                        cell: (ctx) => {
                            const { pausedReason } = ctx.row.original;
                            if (!pausedReason) return "Enabled";

                            const { label, description } = describePausedReason(pausedReason);
                            return (
                                <span className="text-muted-foreground" title={description}>
                                    {label}
                                </span>
                            );
                        },
                        enableSorting: true,
                        enableGlobalFilter: true,
                        enableColumnFilter: false,
                    },
                ),
                columnHelper.accessor((row) => row.lastRun?.startedAt, {
                    id: "lastRun",
                    header: "Last Run",
                    cell: (ctx) => {
                        const { lastRun } = ctx.row.original;
                        if (!lastRun) return <span className="text-muted-foreground">Never</span>;

                        const when = formatRelativeDateTime(lastRun.startedAt);
                        return lastRun.status === "Completed"
                            ? when
                            : `${when} (${lastRun.status})`;
                    },
                    sortUndefined: "last",
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
            ]),
        [formatRelativeDateTime],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: rules,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        globalFilterFn: "includesString",
        initialState: {
            sorting: [{ id: "team", desc: false }],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Rules</Saratoga.Title>
                <Saratoga.Actions>
                    <Protect permissions={{ d4hNag: ["update"] }}>
                        <D4HNag_CreateRule_Dialog />
                    </Protect>
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
