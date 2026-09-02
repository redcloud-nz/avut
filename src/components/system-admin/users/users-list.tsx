/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";

import { formatDate } from "@/lib/datetime";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

type UserRow = {
    id: string;
    name: string;
    email: string;
    role: string;
    banned: boolean;
    emailVerified: boolean;
    createdAt: Date;
    organizationCount: number;
};

export function SystemAdmin_Users_List() {
    const {
        data: { users },
    } = useSuspenseQuery(trpc.systemAdmin.listUsers.queryOptions());

    const columns = useMemo(
        () =>
            Kaga.defineColumns<UserRow>((columnHelper) => [
                columnHelper.accessor("name", {
                    id: "name",
                    header: "Name",
                    cell: (ctx) => (
                        <Link
                            href={route("/system-admin/users/[user_id]", {
                                user_id: ctx.row.original.id,
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.accessor("email", {
                    id: "email",
                    header: "Email",
                    cell: (ctx) => ctx.getValue(),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.accessor("role", {
                    id: "role",
                    header: "Role",
                    cell: (ctx) => <Badge variant="secondary">{ctx.getValue()}</Badge>,
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.accessor((row) => (row.banned ? "Banned" : "Active"), {
                    id: "status",
                    header: "Status",
                    cell: (ctx) =>
                        ctx.row.original.banned ? (
                            <Badge className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300">
                                Banned
                            </Badge>
                        ) : (
                            <Badge className="bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
                                Active
                            </Badge>
                        ),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.accessor("organizationCount", {
                    id: "organizationCount",
                    header: "Orgs",
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
        [],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        columns,
        data: users,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            columnFilters: [],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "createdAt", desc: true }],
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Users</Saratoga.Title>
                <Saratoga.Actions></Saratoga.Actions>
            </Saratoga.Header>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>
        </Saratoga.Root>
    );
}
