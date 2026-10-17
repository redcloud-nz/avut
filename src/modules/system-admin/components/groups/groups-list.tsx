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
import { Saratoga } from "@/components/blocks/saratoga";
import { OrganizationGroupLink } from "@/components/entity-links/organization-group-link";
import { usePreferences } from "@/hooks/use-preferences";
import { SystemAdmin_CreateGroup_Dialog } from "@/modules/system-admin/components/groups/create-group-dialog";
import { trpc, type RouterOutput } from "@/trpc/client";

type GroupRow = RouterOutput["organizationGroups"]["listGroups"][number];

export function SystemAdmin_Groups_List() {
    const { formatDate } = usePreferences();
    const { data: groups } = useSuspenseQuery(trpc.organizationGroups.listGroups.queryOptions());

    const columns = useMemo(
        () =>
            Kaga.defineColumns<GroupRow>((columnHelper) => [
                columnHelper.accessor("name", {
                    id: "name",
                    header: "Name",
                    cell: (ctx) => <OrganizationGroupLink group={ctx.row.original} />,
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.accessor("slug", {
                    id: "slug",
                    header: "Slug",
                    cell: (ctx) => ctx.getValue(),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.accessor((row) => row.overseer?.name ?? "", {
                    id: "overseer",
                    header: "Overseer",
                    cell: (ctx) => ctx.getValue() || "—",
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.accessor("activeMemberCount", {
                    id: "activeMemberCount",
                    header: "Members",
                    cell: (ctx) => ctx.getValue(),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                    enableHiding: false,
                    meta: Kaga.numericColumnMeta,
                }),
                columnHelper.accessor("createdAt", {
                    id: "createdAt",
                    header: "Created",
                    cell: (ctx) => formatDate(ctx.getValue()),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
            ]),
        [formatDate],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        columns,
        data: groups,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            columnFilters: [],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Groups</Saratoga.Title>
                <Saratoga.Actions>
                    <SystemAdmin_CreateGroup_Dialog />
                </Saratoga.Actions>
            </Saratoga.Header>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>
        </Saratoga.Root>
    );
}
