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

import { useOrganization } from "@/hooks/use-organization";
import { getD4HEquipmentModelsCollection } from "@/lib/collections/equipment-models";

export function D4HViewsModule_EquipmentBrand_Models_List({ brandId }: { brandId: number }) {
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
            Kaga.defineColumns<(typeof models)[number]>((columnHelper) => [
                columnHelper.accessor("id", {
                    header: "Model ID",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: false,
                    enableSorting: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("title", {
                    header: "Model",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
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
                <div className="text-lg font-semibold">Models</div>
            </div>
            <Kaga.TableToolbar table={table} />
            <Show when={isModelsReady} fallback={<Skeleton className="w-full h-10" />}>
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </Show>
        </>
    );
}
