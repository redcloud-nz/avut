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

import { Akagi } from "@/components/blocks/akagi";
import { Hermes } from "@/components/blocks/hermes";
import { ObjectIcons } from "@/components/icons";
import { Show } from "@/components/show";
import { Button } from "@/components/ui/button";

import { Empty, EmptyContent, EmptyDescription, EmptyHeader } from "@/components/ui/empty";

import { useOrganization } from "@/hooks/use-organization";
import { formatDate, formatDateTime } from "@/lib/datetime";
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
            Akagi.defineColumns<RowData>((columnHelper) => [
                // columnHelper.accessor("id", {
                //     header: (ctx) => (
                //         <Akagi.TableHeadCell header={ctx.header}>ID</Akagi.TableHeadCell>
                //     ),
                //     cell: (ctx) => (
                //         <Akagi.TableCell cell={ctx.cell}>
                //             <Link
                //                 href={
                //                     `/main/${organization.slug}/skills/sessions/${ctx.row.original.id}` as Route
                //                 }
                //             >
                //                 {ctx.getValue()}
                //             </Link>
                //         </Akagi.TableCell>
                //     ),
                //     enableSorting: false,
                // }),
                columnHelper.accessor("name", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Name</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link
                                href={route("/main/[slug]/skills/sessions/[session_id]", {
                                    slug: organization.slug,
                                    session_id: ctx.row.original.id,
                                })}
                            >
                                {ctx.getValue() || ctx.row.original.id}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    meta: { columnName: "Name" },
                }),
                columnHelper.accessor("updatedAt", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Updated</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {formatDate(ctx.getValue())}
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    meta: { columnName: "Updated" },
                }),
                columnHelper.accessor("status", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell
                            header={ctx.header}
                            filterOptions={["Draft", "Include", "Exclude"]}
                            className="w-25"
                        >
                            Status
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>{ctx.getValue()}</Akagi.TableCell>
                    ),
                    enableColumnFilter: true,
                    enableSorting: false,
                    filterFn: "arrIncludesSome",
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
            pagination: { pageIndex: 0, pageSize: Akagi.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "updatedAt", desc: true }],
        },
    });

    const [createSessionDialogOpen, setCreateSessionDialogOpen] = useState(false);

    return (
        <>
            <Hermes.Header>
                <Hermes.Title>Skill Check Sessions</Hermes.Title>
                <Hermes.Action>
                    <Button variant="outline" onClick={() => setCreateSessionDialogOpen(true)}>
                        <ObjectIcons.Create />
                        <span className="hidden sm:inline">New Session</span>
                    </Button>
                </Hermes.Action>
            </Hermes.Header>
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
                <Akagi.TableToolbar table={table} />
                <Akagi.Table table={table} />
            </Show>
            <SkillsModule_CreateSession_Dialog
                open={createSessionDialogOpen}
                onOpenChange={setCreateSessionDialogOpen}
            />
        </>
    );
}
