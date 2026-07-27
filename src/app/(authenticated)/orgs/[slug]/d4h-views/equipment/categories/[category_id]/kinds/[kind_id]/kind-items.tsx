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
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";

import { useOrganization } from "@/hooks/use-organization";
import { getD4HEquipmentItemsCollection } from "@/lib/collections/d4h-equipment-items";
import { D4HEquipmentItem } from "@/lib/schemas/d4h/equipment-item";
import { route } from "@/lib/routes";

export function D4HViewsModule_EquipmentKind_Items_List({ kindId }: { kindId: number }) {
    const organization = useOrganization();

    const { data: items = [], isReady: isItemsReady } = useLiveQuery(
        (q) =>
            q
                .from({
                    item: getD4HEquipmentItemsCollection(organization.id),
                })
                .where(({ item }) => eq(item.kind.id, kindId)),
        [organization.id, kindId],
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<D4HEquipmentItem>((columnHelper) => [
                columnHelper.accessor("ref", {
                    header: "Ref",
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/d4h-views/equipment/items/[item_id]", {
                                slug: organization.slug,
                                item_id: String(ctx.row.original.id),
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("kind.title", {
                    header: "Kind",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("model.title", {
                    header: "Model",
                    cell: (ctx) => ctx.getValue() ?? "",
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("status", {
                    header: "Status",
                    cell: (ctx) => ctx.getValue(),
                    filterFn: Kaga.filterFns.oneOf,
                    enableColumnFilter: true,
                    enableGlobalFilter: false,
                    enableSorting: false,
                    meta: {
                        columnOptions: [
                            { label: "OPERATIONAL", value: "OPERATIONAL" },
                            { label: "UNSERVICEABLE", value: "UNSERVICEABLE" },
                            { label: "RETIRED", value: "RETIRED" },
                        ],
                    },
                }),
            ]),
        [organization.slug],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: items,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            columnFilters: [{ id: "status", value: ["OPERATIONAL", "UNSERVICEABLE"] }],
            pagination: {
                pageIndex: 0,
                pageSize: Kaga.DEFAULT_PAGE_SIZE,
            },
            sorting: [{ id: "ref", desc: false }],
        },
    });

    return (
        <>
            <div className="flex items-center justify-between mt-4">
                <div className="text-lg font-semibold">Items in Kind</div>
            </div>
            <Kaga.TableToolbar table={table} />
            <Show when={isItemsReady} fallback={<Skeleton className="w-full h-10" />}>
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </Show>
        </>
    );
}
