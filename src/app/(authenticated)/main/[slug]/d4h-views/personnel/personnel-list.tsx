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

import { Akagi } from "@/components/blocks/akagi";
import { Hermes } from "@/components/blocks/hermes";
import { D4HMember } from "@/lib/schemas/d4h/member";
import { D4HTeamRef } from "@/lib/schemas/d4h/team";

interface D4HViewsModules_Personnel_ListProps {
    members: (D4HMember & { team: D4HTeamRef })[];
    teams: D4HTeamRef[];
}

export function D4HViewsModules_Personnel_List({
    members,
    teams,
}: D4HViewsModules_Personnel_ListProps) {
    const columns = useMemo(
        () =>
            Akagi.defineColumns<D4HMember & { team: D4HTeamRef }>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Name</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>{ctx.getValue()}</Akagi.TableCell>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                }),
                columnHelper.accessor("team.title", {
                    id: "team",
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Team</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>{ctx.getValue()}</Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: false,
                }),
                columnHelper.accessor("status", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell
                            header={ctx.header}
                            filterOptions={[
                                {
                                    value: "OPERATIONAL",
                                    label: "Operational",
                                },
                                {
                                    value: "NON_OPERATIONAL",
                                    label: "Non-operational",
                                },
                            ]}
                        >
                            Status
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {match(ctx.getValue())
                                .with("OPERATIONAL", () => "Operational")
                                .with("NON_OPERATIONAL", () => "Non-operational")
                                .otherwise(() => ctx.getValue())}
                        </Akagi.TableCell>
                    ),
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    filterFn: (row, columnId, filterValue) => {
                        const rowValue = row.getValue(columnId) as string;
                        return filterValue.includes(rowValue);
                    },
                }),
            ]),
        [],
    );

    const table = useReactTable({
        data: members,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            columnFilters: [{ id: "status", value: ["OPERATIONAL", "NON_OPERATIONAL"] }],
            pagination: { pageIndex: 0, pageSize: Akagi.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <>
            <div className="flex items-center justify-between">
                <Akagi.TableSearch table={table} />
            </div>
            <Akagi.Table table={table} />
        </>
    );
}
