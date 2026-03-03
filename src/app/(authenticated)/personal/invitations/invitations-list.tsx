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
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Akagi } from "@/components/blocks/akagi";
import { Link } from "@/components/ui/link";

import { formatDate } from "@/lib/datetime";
import { OrganizationInvitationData } from "@/lib/schemas/organization-invitation";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

type RowData = OrganizationInvitationData & {
    organization: { name: string };
    inviter: { name: string };
};

export function Personal_Invitations_List() {
    const { data: invitations } = useSuspenseQuery(
        trpc.invitations.listUserInvitations.queryOptions(),
    );

    const columns = useMemo(
        () =>
            Akagi.defineColumns<RowData>((columnHelper) => [
                columnHelper.accessor("id", {
                    id: "id",
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            ID
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            <Link
                                to={Paths.personal.invitation(
                                    ctx.row.original.id,
                                )}
                            >
                                {ctx.getValue()}
                            </Link>
                        </Akagi.TableCell>
                    ),
                    enableSorting: false,
                    enableGlobalFilter: false,
                }),
                columnHelper.accessor("organization.name", {
                    id: "organizationName",
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Organization
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                }),
                columnHelper.accessor("inviter.name", {
                    id: "inviterName",
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Invited By
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                }),
                columnHelper.accessor("createdAt", {
                    id: "createdAt",
                    header: (ctx) => (
                        <Akagi.TableHeadCell header={ctx.header}>
                            Created
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {formatDate(ctx.getValue())}
                        </Akagi.TableCell>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: false,
                }),
                columnHelper.accessor("status", {
                    id: "status",
                    header: (ctx) => (
                        <Akagi.TableHeadCell
                            header={ctx.header}
                            filterOptions={[
                                "canceled",
                                "rejected",
                                "accepted",
                                "pending",
                            ]}
                        >
                            Status
                        </Akagi.TableHeadCell>
                    ),
                    cell: (ctx) => (
                        <Akagi.TableCell cell={ctx.cell}>
                            {ctx.getValue()}
                        </Akagi.TableCell>
                    ),
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    filterFn: "arrIncludesSome",
                }),
            ]),
        [],
    );

    const table = useReactTable({
        data: invitations,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        initialState: {
            columnFilters: [{ id: "status", value: ["pending"] }],
            sorting: [{ id: "createdAt", desc: true }],
        },
    });

    return (
        <>
            <div className="flex items-center justify-between">
                <Akagi.TableSearch table={table} />
            </div>
            <Akagi.Table table={table} />
        </>
    );
}
