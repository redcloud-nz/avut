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
import { useSuspenseQuery } from "@tanstack/react-query";

import { Kaga } from "@/components/blocks/kaga";
import Link from "next/link";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

export function I3Module_TemplateList() {
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
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/i3/templates/[template_id]", {
                                slug: organization.slug,
                                template_id: ctx.row.original.id,
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableColumnFilter: false,
                }),
                col.accessor("d4h.categoryTitle", {
                    header: "D4H Category",
                    cell: (ctx) => ctx.getValue(),
                    enableColumnFilter: false,
                    enableSorting: false,
                    enableGlobalFilter: false,
                }),
                col.accessor("d4h.kindTitle", {
                    header: "D4H Kind",
                    cell: (ctx) => ctx.getValue(),
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
        [organization.slug],
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
