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
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { route } from "@/lib/routes";
import type { D4HNagRuleId, D4HNagRunListItem, D4HNagRunTrigger } from "@/lib/schemas/d4h-nag";
import { trpc } from "@/trpc/client";

/** How often the table refetches while one of its runs is still `Running`. */
const RUNNING_REFETCH_MS = 3000;

const TRIGGER_LABELS: Record<D4HNagRunTrigger, string> = {
    Cron: "Scheduled",
    Manual: "Manual",
};

/** What started a run, in words. Shared by the runs table and the run page. */
export function describeRunTrigger(trigger: D4HNagRunTrigger): string {
    return TRIGGER_LABELS[trigger];
}

/**
 * One rule's runs, newest first. While a run is in progress (a Run now or Dry run finishes in
 * the background) the table refetches until it completes.
 */
export function D4HNag_Runs_Table({ ruleId }: { ruleId: D4HNagRuleId }) {
    const organization = useOrganization();
    const { formatDateTime } = usePreferences();

    const { data: runs } = useSuspenseQuery(
        trpc.d4hNag.listRuns.queryOptions(
            { organizationId: organization.id, ruleId },
            {
                refetchInterval: (query) =>
                    query.state.data?.some((run) => run.status === "Running")
                        ? RUNNING_REFETCH_MS
                        : false,
            },
        ),
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<D4HNagRunListItem>((columnHelper) => [
                columnHelper.accessor("startedAt", {
                    header: "Started",
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/d4h-nag/runs/[run_id]", {
                                slug: organization.slug,
                                run_id: ctx.row.original.id,
                            })}
                            className="hover:underline"
                        >
                            {formatDateTime(ctx.getValue())}
                        </Link>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor((row) => TRIGGER_LABELS[row.trigger], {
                    id: "trigger",
                    header: "Trigger",
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("dryRun", {
                    header: "Dry Run",
                    cell: (ctx) => (ctx.getValue() ? "Yes" : "No"),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("exercisesFound", {
                    header: "Exercises",
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("sentCount", {
                    header: "Sent",
                    // A dry run counts the reminders it would have sent here (its `DryRun` rows).
                    cell: (ctx) =>
                        ctx.row.original.dryRun ? (
                            <span className="text-muted-foreground">
                                {ctx.getValue()} would send
                            </span>
                        ) : (
                            ctx.getValue()
                        ),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("skippedCount", {
                    header: "Skipped",
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("failedCount", {
                    header: "Failed",
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("status", {
                    header: "Status",
                    cell: (ctx) => {
                        const { status, error } = ctx.row.original;
                        if (status === "Running") {
                            return <span className="text-muted-foreground">Running…</span>;
                        }
                        if (status === "Failed") {
                            return (
                                <span className="text-destructive" title={error ?? undefined}>
                                    Failed
                                </span>
                            );
                        }
                        return status;
                    },
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
            ]),
        [formatDateTime, organization.slug],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: runs,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            sorting: [{ id: "startedAt", desc: true }],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
        },
    });

    return (
        <div>
            <Kaga.Table table={table} />
            <Kaga.TablePagination table={table} />
        </div>
    );
}
