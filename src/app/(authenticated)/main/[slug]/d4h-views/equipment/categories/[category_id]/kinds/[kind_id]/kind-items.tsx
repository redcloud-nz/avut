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
            Akagi.defineColumns<D4HEquipmentItem>((columnHelper) => [
                columnHelper.accessor("ref", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Ref</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link
                                href={route("/main/[slug]/d4h-views/equipment/items/[item_id]", {
                                    slug: organization.slug,
                                    item_id: String(ctx.row.original.id),
                                })}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                }),
                columnHelper.accessor("kind.title", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Kind</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>{ctx.getValue()}</Akagi.TableCell>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                }),
                columnHelper.accessor("model.title", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Model</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>{ctx.getValue() ?? ""}</Akagi.TableCell>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                }),
                columnHelper.accessor("status", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell
                            header={ctx.header}
                            filterOptions={["OPERATIONAL", "UNSERVICEABLE", "RETIRED"]}
                        >
                            Status
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>{ctx.getValue()}</Akagi.TableCell>
                    ),
                    filterFn: "arrIncludesSome",
                    enableColumnFilter: true,
                    enableGlobalFilter: false,
                    enableSorting: false,
                }),
            ]),
        [],
    );

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
                pageSize: Akagi.DEFAULT_PAGE_SIZE,
            },
            sorting: [{ id: "ref", desc: false }],
        },
    });

    return (
        <>
            <div className="flex items-center justify-between mt-4">
                <div className="text-lg font-semibold">Items in Kind</div>
                <Akagi.TableSearch table={table} />
            </div>
            <Show when={isItemsReady} fallback={<Skeleton className="w-full h-10" />}>
                <Akagi.Table table={table} />
            </Show>
        </>
    );
}
