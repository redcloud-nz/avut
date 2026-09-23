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
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { route } from "@/lib/routes";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { trpc } from "@/trpc/client";
import type { RouterOutput } from "@/trpc/routers/_app";

type Membership = RouterOutput["user"]["listMemberships"][number];

export function UserSettings_OrganizationsList() {
    const { data: memberships } = useSuspenseQuery(trpc.user.listMemberships.queryOptions());

    const columns = useMemo(
        () =>
            Kaga.defineColumns<Membership>((columnHelper) => [
                columnHelper.accessor((row) => row.organization.name, {
                    id: "name",
                    header: "Name",
                    cell: (ctx) => {
                        const organization = ctx.row.original.organization;
                        return (
                            <Link
                                href={route("/user/settings/organizations/[organization_id]", {
                                    organization_id: organization.id,
                                })}
                                className="font-medium"
                            >
                                {organization.name}
                            </Link>
                        );
                    },
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor((row) => row.organization.slug, {
                    id: "slug",
                    header: "Slug",
                    cell: (ctx) => ctx.getValue(),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("roles", {
                    header: "Roles",
                    cell: (ctx) => OrganizationRole.formatList(ctx.getValue()),
                    enableSorting: false,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("createdAt", {
                    header: "Joined",
                    cell: (ctx) => new Date(ctx.getValue()).toLocaleDateString(),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
            ]),
        [],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: memberships,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Organisations</Saratoga.Title>
            </Saratoga.Header>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
            </div>
        </Saratoga.Root>
    );
}
