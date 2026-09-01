/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import type { Route } from "next";
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
import { SystemAdmin_CreateOrganization_Dialog } from "@/components/system-admin/organizations/create-organization-dialog";

import { formatDate } from "@/lib/datetime";
import { type ModuleId, Modules } from "@/lib/modules";
import { trpc } from "@/trpc/client";

type OrganizationRow = {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    createdAt: Date;
    memberCount: number;
    ownerCount: number;
    enabledModules: ModuleId[];
};

export function SystemAdmin_Organizations_List() {
    const {
        data: { organizations },
    } = useSuspenseQuery(trpc.systemAdmin.listOrganizations.queryOptions());

    const columns = useMemo(
        () =>
            Kaga.defineColumns<OrganizationRow>((columnHelper) => [
                columnHelper.accessor("name", {
                    id: "name",
                    header: "Name",
                    // TODO(phase-5): detail route does not exist yet — link 404s until Phase 5.
                    cell: (ctx) => (
                        <Link href={`/system-admin/organizations/${ctx.row.original.id}` as Route}>
                            {ctx.getValue()}
                        </Link>
                    ),
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
                columnHelper.accessor("memberCount", {
                    id: "memberCount",
                    header: "Members",
                    cell: (ctx) => ctx.getValue(),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.accessor("ownerCount", {
                    id: "ownerCount",
                    header: "Owners",
                    cell: (ctx) => ctx.getValue(),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                    enableHiding: false,
                }),
                columnHelper.accessor("enabledModules", {
                    id: "enabledModules",
                    header: "Modules",
                    cell: (ctx) => (
                        <div className="flex flex-wrap gap-1">
                            {ctx.getValue().map((moduleId: ModuleId) => (
                                <Badge key={moduleId} variant="secondary">
                                    {Modules[moduleId].label}
                                </Badge>
                            ))}
                        </div>
                    ),
                    enableSorting: false,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                    enableHiding: false,
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
        data: organizations,
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
                <Saratoga.Title>Organizations</Saratoga.Title>
                <Saratoga.Actions>
                    <SystemAdmin_CreateOrganization_Dialog />
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
