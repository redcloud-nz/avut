/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useMemo } from "react";

import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { D4HTeam } from "@/lib/schemas/d4h/team";

interface D4HViewsModule_Teams_ListProps {
    teams: D4HTeam[];
}

export function D4HViewsModule_Teams_List({ teams }: D4HViewsModule_Teams_ListProps) {
    const columns = useMemo(
        () =>
            Kaga.defineColumns<D4HTeam>((columnHelper) => [
                columnHelper.accessor("title", {
                    header: "Name",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
            ]),
        [],
    );

    const table = useReactTable({
        data: teams,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Teams</Saratoga.Title>
            </Saratoga.Header>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>
        </Saratoga.Root>
    );
}
