/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { useMemo } from "react";

import { eq, useLiveQuery } from "@tanstack/react-db";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Akagi } from "@/components/blocks/akagi";
import { Show } from "@/components/show";
import { Skeleton } from "@/components/ui/skeleton";

import { getD4HEquipmentKindsCollection } from "@/lib/collections/d4h-equipment-kinds";
import { useOrganization } from "@/hooks/use-organization";
import * as Paths from "@/paths";
import { Link } from "@/components/ui/link";

export function D4HViewsModule_EquipmentCategory_Kinds_List({
    categoryId,
}: {
    categoryId: number;
}) {
    const organization = useOrganization();

    const { data: kinds = [], isReady: isKindsReady } = useLiveQuery(
        (q) =>
            q
                .from({
                    item: getD4HEquipmentKindsCollection(organization.id),
                })
                .where(({ item }) => eq(item.category.id, categoryId)),
        [organization.id, categoryId],
    );

    const columns = useMemo(
        () =>
            Akagi.defineColumns<(typeof kinds)[number]>((columnHelper) => [
                columnHelper.accessor("id", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Kind ID
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link
                                to={Paths.org(organization.slug)
                                    .d4HViews.equipment.category(categoryId)
                                    .kind(ctx.row.original.id)}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: true,
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
                            <Link
                                to={Paths.org(organization.slug)
                                    .d4HViews.equipment.category(categoryId)
                                    .kind(ctx.row.original.id)}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                }),
                columnHelper.accessor("type", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Type
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: false,
                    enableSorting: true,
                }),
            ]),
        [],
    );

    const table = useReactTable({
        data: kinds,
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
            <div className="flex items-center justify-between mt-4">
                <div className="text-lg font-semibold">Kinds in Category</div>
                <Akagi.TableSearch table={table} />
            </div>
            <Show
                when={isKindsReady}
                fallback={<Skeleton className="w-full h-10" />}
            >
                <Akagi.Table table={table} />
            </Show>
        </>
    );
}
