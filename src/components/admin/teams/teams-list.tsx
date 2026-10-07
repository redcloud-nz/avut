/*
 *  Copyright (c) 2025 A.V.U.T. Project.
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
import { TablePseudoQuery } from "@/components/blocks/table-pseudo-query";
import { TeamLink } from "@/components/entity-links/team-link";
import { Protect } from "@/components/protect";
import { useOrganization } from "@/hooks/use-organization";
import { TeamData } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

import { AdminModule_CreateTeam_Dialog } from "./create-team";

/**
 * List of teams in the organization.
 */
export function AdminModule_Teams_List() {
    const organization = useOrganization();

    const { data: teams } = useSuspenseQuery(
        trpc.teams.listTeams.queryOptions({
            organizationId: organization.id,
        }),
    );

    type RowData = TeamData;

    const columns = useMemo(
        () =>
            Kaga.defineColumns<RowData>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: "Name",
                    cell: (ctx) => <TeamLink team={ctx.row.original} />,
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("description", {
                    header: "Description",
                    cell: (ctx) => ctx.getValue(),
                    enableSorting: true,
                    enableGlobalFilter: true,
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
                            { label: "Active", value: "Active" },
                            { label: "Archived", value: "Archived" },
                        ],
                    },
                }),
            ]),
        [],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: teams,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        globalFilterFn: "includesString",
        initialState: {
            columnFilters: [{ id: "status", value: ["Active"] }],
            sorting: [{ id: "name", desc: false }],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Teams</Saratoga.Title>
                <Saratoga.Actions>
                    <Protect permissions={{ team: ["create"] }}>
                        <AdminModule_CreateTeam_Dialog />
                    </Protect>
                </Saratoga.Actions>
            </Saratoga.Header>
            <div>
                <Kaga.TableToolbar
                    table={table}
                    query={<TablePseudoQuery table={table} config={{ table: "Teams" }} />}
                />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>
        </Saratoga.Root>
    );
}
