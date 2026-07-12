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

import { Kaga } from "@/components/blocks/kaga";
import { Show } from "@/components/show";
import { Skeleton } from "@/components/ui/skeleton";

import { getD4HEquipmentKindsCollection } from "@/lib/collections/d4h-equipment-kinds";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import Link from "next/link";

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
            Kaga.defineColumns<(typeof kinds)[number]>((columnHelper) => [
                columnHelper.accessor("id", {
                    header: "Kind ID",
                    cell: (ctx) => (
                        <Link
                            href={route(
                                "/orgs/[slug]/d4h-views/equipment/categories/[category_id]/kinds/[kind_id]",
                                {
                                    slug: organization.slug,
                                    category_id: String(categoryId),
                                    kind_id: String(ctx.row.original.id),
                                },
                            )}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("title", {
                    header: "Title",
                    cell: (ctx) => (
                        <Link
                            href={route(
                                "/orgs/[slug]/d4h-views/equipment/categories/[category_id]/kinds/[kind_id]",
                                {
                                    slug: organization.slug,
                                    category_id: String(categoryId),
                                    kind_id: String(ctx.row.original.id),
                                },
                            )}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("type", {
                    header: "Type",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: false,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
            ]),
        [organization.slug, categoryId],
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
                pageSize: Kaga.DEFAULT_PAGE_SIZE,
            },
            sorting: [{ id: "title", desc: false }],
        },
    });

    return (
        <>
            <div className="flex items-center justify-between mt-4">
                <div className="text-lg font-semibold">Kinds in Category</div>
            </div>
            <Kaga.TableToolbar table={table} />
            <Show when={isKindsReady} fallback={<Skeleton className="w-full h-10" />}>
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </Show>
        </>
    );
}
