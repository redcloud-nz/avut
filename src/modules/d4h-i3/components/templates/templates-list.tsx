/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useMemo } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { D4HEquipmentCategoryLink } from "@/components/entity-links/d4h-equipment-category-link";
import { D4HEquipmentTypeLink } from "@/components/entity-links/d4h-equipment-type-link";
import { I3TemplateLink } from "@/components/entity-links/i3-template-link";
import { useOrganization } from "@/hooks/use-organization";
import { trpc } from "@/trpc/client";

export function D4HI3Module_TemplateList() {
    const organization = useOrganization();

    const { data: templates } = useSuspenseQuery(
        trpc.i3.listTemplates.queryOptions({
            organizationId: organization.id,
        }),
    );

    type RowData = (typeof templates)[number];

    const columns = useMemo(
        () =>
            Kaga.defineColumns<RowData>((col) => [
                col.accessor("name", {
                    header: "Name",
                    cell: (ctx) => <I3TemplateLink template={ctx.row.original} />,
                    enableColumnFilter: false,
                }),
                col.accessor("d4h.categoryTitle", {
                    header: "D4H Category",
                    cell: (ctx) => {
                        const { d4h } = ctx.row.original;
                        if (!d4h) return "—";
                        return (
                            <D4HEquipmentCategoryLink
                                category={{ id: d4h.categoryId, title: d4h.categoryTitle }}
                            />
                        );
                    },
                    enableColumnFilter: false,
                    enableSorting: false,
                    enableGlobalFilter: false,
                }),
                col.accessor("d4h.kindTitle", {
                    header: "D4H Type",
                    cell: (ctx) => {
                        const { d4h } = ctx.row.original;
                        if (!d4h) return "—";
                        return (
                            <D4HEquipmentTypeLink type={{ id: d4h.kindId, title: d4h.kindTitle }} />
                        );
                    },
                    enableColumnFilter: false,
                    enableSorting: false,
                    enableGlobalFilter: false,
                }),
                col.accessor("variants", {
                    header: "Variants",
                    cell: (ctx) => ctx.getValue().length,
                    enableColumnFilter: false,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    meta: {
                        headerProps: {
                            className: "text-center",
                        },
                        cellProps: {
                            className: "text-center",
                        },
                    },
                }),
                // col.accessor("status", {
                //     header: "Status",
                //     cell: (ctx) => ctx.getValue(),
                //     enableSorting: false,
                //     enableGlobalFilter: false,
                //     filterFn: Kaga.filterFns.oneOf,
                //     meta: {
                //         columnOptions: [
                //             { label: "Active", value: "Active" },
                //             { label: "Archived", value: "Archived" },
                //         ],
                //     },
                // }),
            ]),
        [],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: templates,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            columnFilters: [{ id: "status", value: ["Active"] }],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <div>
            <Kaga.TableToolbar table={table} />
            <Kaga.Table table={table} />
            <Kaga.TablePagination table={table} />
        </div>
    );
}
