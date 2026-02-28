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

import { Akagi } from "@/components/blocks/akagi";
import { Hermes } from "@/components/blocks/hermes";
import { D4HTeam } from "@/lib/d4h-api/team";

interface D4HViewsModule_Teams_ListProps {
    teams: D4HTeam[];
}

export function D4HViewsModule_Teams_List({
    teams,
}: D4HViewsModule_Teams_ListProps) {
    const columns = useMemo(
        () =>
            Akagi.defineColumns<D4HTeam>((columnHelper) => [
                columnHelper.accessor("title", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Name
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
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
        <Hermes.Section>
            <Hermes.Header>
                <Akagi.TableSearch table={table} />
            </Hermes.Header>
            <Akagi.Table table={table} />
        </Hermes.Section>
    );
}
