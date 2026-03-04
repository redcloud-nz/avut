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

import { D4HEquipmentCategory } from "@/lib/d4h-api/equipment-category";

interface D4HViewsModules_EquipmentCategories_ListProps {
    categories: D4HEquipmentCategory[];
}

export function D4HViewsModules_EquipmentCategories_List({
    categories,
}: D4HViewsModules_EquipmentCategories_ListProps) {
    const columns = useMemo(
        () =>
            Akagi.defineColumns<D4HEquipmentCategory>((columnHelper) => [
                columnHelper.accessor("id", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header} align="center">
                            Category ID
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell} align="center">
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: false,
                    enableSorting: true,
                }),
                columnHelper.accessor("title", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Title
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
        data: categories,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            pagination: {
                pageIndex: 0,
                pageSize: Akagi.DEFAULT_PAGE_SIZE,
            },
            sorting: [{ id: "title", desc: false }],
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
