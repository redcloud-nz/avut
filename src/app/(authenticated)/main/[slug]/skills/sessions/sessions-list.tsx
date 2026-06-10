/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
import { Show } from "@/components/show";
import { Button } from "@/components/ui/button";

import { Empty, EmptyContent, EmptyDescription, EmptyHeader } from "@/components/ui/empty";

import { useOrganization } from "@/hooks/use-organization";
import { formatDate } from "@/lib/datetime";
import { route } from "@/lib/routes";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";

import { SkillsModule_CreateSession_Dialog } from "./create-session";

export default function SkillsModule_Sessions_List() {
    const organization = useOrganization();

    const { data: sessions } = useSuspenseQuery(
        trpc.skills.listSessions.queryOptions({
            organizationId: organization.id,
        }),
    );

    type RowData = SkillCheckSession;

    const columns = useMemo(
        () =>
            Kaga.defineColumns<RowData>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: "Name",
                    cell: (ctx) => (
                        <Link
                            href={route("/main/[slug]/skills/sessions/[session_id]", {
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
        [],
    );

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

    const [createSessionDialogOpen, setCreateSessionDialogOpen] = useState(false);

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Skill Check Sessions</Saratoga.Title>
                <Saratoga.Actions>
                    <Button variant="outline" onClick={() => setCreateSessionDialogOpen(true)}>
                        <ObjectIcons.Create />
                        <span className="hidden sm:inline">New Session</span>
                    </Button>
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
                        <EmptyContent>
                            <Button onClick={() => setCreateSessionDialogOpen(true)}>
                                New Session
                            </Button>
                        </EmptyContent>
                    </Empty>
                }
            >
                <div>
                    <Kaga.TableToolbar table={table} />
                    <Kaga.Table table={table} />
                    <Kaga.TablePagination table={table} />
                </div>
            </Show>
            <SkillsModule_CreateSession_Dialog
                open={createSessionDialogOpen}
                onOpenChange={setCreateSessionDialogOpen}
            />
        </Saratoga.Root>
    );
}
