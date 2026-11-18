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
import { I3BundleLink } from "@/components/entity-links/i3-bundle-link";
import { useOrganization } from "@/hooks/use-organization";
import { trpc } from "@/trpc/client";

export function D4HI3Module_BundleList() {
    const organization = useOrganization();

    const { data: bundles } = useSuspenseQuery(
        trpc.i3Bundles.listBundles.queryOptions({
            organizationId: organization.id,
        }),
    );

    type RowData = (typeof bundles)[number];

    const columns = useMemo(
        () =>
            Kaga.defineColumns<RowData>((col) => [
                col.accessor("name", {
                    header: "Name",
                    cell: (ctx) => <I3BundleLink bundle={ctx.row.original} />,
                    enableColumnFilter: false,
                }),
                col.accessor("description", {
                    header: "Description",
                    cell: (ctx) => ctx.getValue() || "—",
                    enableColumnFilter: false,
                    enableSorting: false,
                }),
                col.accessor("templateCount", {
                    header: "Templates",
                    cell: (ctx) => ctx.getValue(),
                    enableColumnFilter: false,
                    enableGlobalFilter: false,
                    meta: {
                        headerProps: { className: "text-center" },
                        cellProps: { className: "text-center" },
                    },
                }),
            ]),
        [],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: bundles,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
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
