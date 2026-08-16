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
import { Show } from "@/components/show";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { ClipboardCheckIcon } from "lucide-react";

import { useOrganization } from "@/hooks/use-organization";
import { formatDate } from "@/lib/datetime";
import { route } from "@/lib/routes";
import {
    getEnabledSkillCheckResultOptions,
    getSkillCheckResultLabel,
} from "@/lib/schemas/skill-check";
import { trpc } from "@/trpc/client";

export default function SkillTrack_ChecksList() {
    const organization = useOrganization();

    const { data: checks } = useSuspenseQuery(
        trpc.skillChecks.listRecentChecks.queryOptions({
            organizationId: organization.id,
        }),
    );

    type Row = (typeof checks)[number];

    const columns = useMemo(
        () =>
            Kaga.defineColumns<Row>((col) => [
                col.accessor((row) => row.assessee.name, {
                    id: "assessee",
                    header: "Assessee",
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                col.accessor((row) => row.skill.name, {
                    id: "skill",
                    header: "Skill",
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                col.accessor("result", {
                    header: "Result",
                    cell: (ctx) => getSkillCheckResultLabel(organization.settings, ctx.getValue()),
                    enableSorting: false,
                    enableGlobalFilter: false,
                    enableColumnFilter: true,
                    filterFn: Kaga.filterFns.oneOf,
                    meta: {
                        columnOptions: getEnabledSkillCheckResultOptions(organization.settings),
                    },
                }),
                col.accessor((row) => (row.session ? row.session.name || row.session.id : null), {
                    id: "session",
                    header: "Session",
                    cell: (ctx) => {
                        const row = ctx.row.original;
                        if (!row.session) return <span className="text-muted-foreground">—</span>;
                        const label = row.session.name || row.session.id;
                        return (
                            <Link
                                href={route("/orgs/[slug]/skill-track/sessions/[session_id]", {
                                    slug: organization.slug,
                                    session_id: row.session.id,
                                })}
                            >
                                {label}
                            </Link>
                        );
                    },
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                col.accessor("createdAt", {
                    header: "Date",
                    cell: (ctx) => formatDate(ctx.getValue()),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                col.accessor((row) => row.assessor.name, {
                    id: "assessor",
                    header: "Assessor",
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
            ]),
        [organization.slug, organization.settings],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: checks,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "createdAt", desc: true }],
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Recent Skill Checks</Saratoga.Title>
            </Saratoga.Header>
            <Show
                when={checks.length > 0}
                fallback={
                    <Empty>
                        <EmptyMedia>
                            <ClipboardCheckIcon className="size-12 text-muted-foreground" />
                        </EmptyMedia>
                        <EmptyDescription>
                            No skill checks were recorded in the last month.
                        </EmptyDescription>
                    </Empty>
                }
            >
                <div>
                    <Kaga.TableToolbar table={table} />
                    <Kaga.Table table={table} />
                    <Kaga.TablePagination table={table} />
                </div>
            </Show>
        </Saratoga.Root>
    );
}
