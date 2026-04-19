/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { useMemo } from "react";

import { useSuspenseQueries, useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Akagi } from "@/components/blocks/akagi";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { trpc } from "@/trpc/client";

export function AdminModule_AccessControl_List() {
    const organization = useOrganization();

    const { data: personnel } = useSuspenseQuery(
        trpc.accessControl.listPersonnelWithAccess.queryOptions({
            organizationId: organization.id,
        }),
    );

    const columns = useMemo(
        () =>
            Akagi.defineColumns<(typeof personnel)[0]>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Name</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link
                                href={route("/main/[slug]/admin/access/[person_id]", {
                                    slug: organization.slug,
                                    person_id: ctx.row.original.id,
                                })}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                }),
                columnHelper.accessor("email", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Email</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link
                                href={route("/main/[slug]/admin/access/[person_id]", {
                                    slug: organization.slug,
                                    person_id: ctx.row.original.id,
                                })}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                }),
                columnHelper.accessor("roles", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>Roles</Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.row.original.roles
                                .map((role) => OrganizationRole.displayNames[role])
                                .join(", ")}
                        </Akagi.TableCell>
                    ),
                    enableSorting: false,
                    enableGlobalFilter: false,
                }),
                columnHelper.accessor("accessStatus", {
                    header: (ctx) => (
                        <Akagi.TableHeadCell
                            header={ctx.header}
                            filterOptions={["Joined", "Invited", "None"]}
                        >
                            Status
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>{ctx.getValue()}</Akagi.TableCell>
                    ),
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    filterFn: "arrIncludesSome",
                }),
            ]),
        [],
    );

    const table = useReactTable<(typeof personnel)[0]>({
        columns,
        data: personnel,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            columnFilters: [{ id: "accessStatus", value: ["Joined", "Invited"] }],
            pagination: { pageIndex: 0, pageSize: Akagi.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <>
            <div className="flex items-center justify-baseline">
                <Akagi.TableSearch table={table} />
            </div>
            <Akagi.Table table={table} />
        </>
    );
}
