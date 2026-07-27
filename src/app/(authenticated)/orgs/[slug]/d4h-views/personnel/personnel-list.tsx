/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useMemo } from "react";
import { match } from "ts-pattern";

import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { D4HMember } from "@/lib/schemas/d4h/member";
import { D4HTeamRef } from "@/lib/schemas/d4h/team";

interface D4HViewsModules_Personnel_ListProps {
    members: (D4HMember & { team: D4HTeamRef })[];
    teams: D4HTeamRef[];
}

export function D4HViewsModules_Personnel_List({ members }: D4HViewsModules_Personnel_ListProps) {
    const columns = useMemo(
        () =>
            Kaga.defineColumns<D4HMember & { team: D4HTeamRef }>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: "Name",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("team.title", {
                    id: "team",
                    header: "Team",
                    cell: (ctx) => ctx.getValue(),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("status", {
                    header: "Status",
                    cell: (ctx) =>
                        match(ctx.getValue())
                            .with("OPERATIONAL", () => "Operational")
                            .with("NON_OPERATIONAL", () => "Non-operational")
                            .otherwise(() => ctx.getValue()),
                    filterFn: Kaga.filterFns.oneOf,
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    meta: {
                        columnOptions: [
                            { value: "OPERATIONAL", label: "Operational" },
                            { value: "NON_OPERATIONAL", label: "Non-operational" },
                        ],
                    },
                }),
            ]),
        [],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: members,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            columnFilters: [{ id: "status", value: ["OPERATIONAL", "NON_OPERATIONAL"] }],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Personnel</Saratoga.Title>
            </Saratoga.Header>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>
        </Saratoga.Root>
    );
}
