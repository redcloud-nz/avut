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
import { Protect } from "@/components/protect";
import { Saratoga } from "@/components/blocks/saratoga";
import { Show } from "@/components/show";

import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";

import { useOrganization } from "@/hooks/use-organization";
import { formatDate } from "@/lib/datetime";
import { PersonRef } from "@/lib/schemas/person";
import { route } from "@/lib/routes";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

import { SkillTrack_CreateSession_Dialog } from "./create-session";

export default function SkillTrack_Sessions_List() {
    const organization = useOrganization();

    const { data: sessions } = useSuspenseQuery(
        trpc.skills.listSessions.queryOptions({
            organizationId: organization.id,
        }),
    );

    type RowData = SkillCheckSession & { assessors: PersonRef[] };

    const columns = useMemo(
        () =>
            Kaga.defineColumns<RowData>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: "Name",
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/skill-track/sessions/[session_id]", {
                                slug: organization.slug,
                                session_id: ctx.row.original.id,
                            })}
                        >
                            {ctx.getValue() || ctx.row.original.id}
                        </Link>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor((row) => row.assessors.map((a) => a.name).join(", "), {
                    id: "assessor",
                    header: "Assessor",
                    cell: (ctx) => ctx.getValue() || "—",
                    enableSorting: false,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("updatedAt", {
                    header: "Updated",
                    cell: (ctx) => formatDate(ctx.getValue()),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("status", {
                    header: "Status",
                    cell: (ctx) => ctx.getValue(),
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    filterFn: Kaga.filterFns.oneOf,
                    meta: {
                        columnOptions: [
                            { label: "Draft", value: "Draft" },
                            { label: "Include", value: "Include" },
                            { label: "Exclude", value: "Exclude" },
                        ],
                    },
                }),
            ]),
        [organization.slug],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: sessions,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            columnFilters: [{ id: "status", value: ["Draft", "Include", "Exclude"] }],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "updatedAt", desc: true }],
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Skill Check Sessions</Saratoga.Title>
                <Saratoga.Actions>
                    <Protect permissions={{ skillCheckSession: ["create"] }}>
                        <SkillTrack_CreateSession_Dialog />
                    </Protect>
                </Saratoga.Actions>
            </Saratoga.Header>
            <Show
                when={sessions.length > 0}
                fallback={
                    <Empty>
                        <EmptyHeader>No sessions found</EmptyHeader>
                        <EmptyDescription>
                            No skill check sessions have been created yet.
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
