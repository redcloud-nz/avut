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

import { useOrganization } from "@/hooks/use-organization";
import { getD4HEquipmentModelsCollection } from "@/lib/collections/equipment-models";

export function D4HViewsModule_EquipmentBrand_Models_List({
    brandId,
}: {
    brandId: number;
}) {
    const organization = useOrganization();

    const { data: models = [], isReady: isModelsReady } = useLiveQuery(
        (q) =>
            q
                .from({
                    item: getD4HEquipmentModelsCollection(organization.id),
                })
                .where(({ item }) => eq(item.brand.id, brandId)),
        [organization.id, brandId],
    );

    const columns = useMemo(
        () =>
            Akagi.defineColumns<(typeof models)[number]>((columnHelper) => [
                columnHelper.accessor("id", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Model ID
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableGlobalFilter: false,
                    enableSorting: false,
                }),
                columnHelper.accessor("title", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Model
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
        data: models,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            columnFilters: [
                { id: "status", value: ["OPERATIONAL", "UNSERVICEABLE"] },
            ],
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
                <div className="text-lg font-semibold">Models</div>
                <Akagi.TableSearch table={table} />
            </div>
            <Show
                when={isModelsReady}
                fallback={<Skeleton className="w-full h-10" />}
            >
                <Akagi.Table table={table} />
            </Show>
        </>
    );
}
