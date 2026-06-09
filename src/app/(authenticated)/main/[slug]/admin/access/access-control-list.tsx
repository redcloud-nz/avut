/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { SendIcon } from "lucide-react";

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
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { trpc } from "@/trpc/client";

import { AdminModule_CreateInvitation_Dialog } from "./create-invitation";

export function AdminModule_AccessControl_List() {
    const organization = useOrganization();

    const { data: personnel } = useSuspenseQuery(
        trpc.accessControl.listPersonnelWithAccess.queryOptions({
            organizationId: organization.id,
        }),
    );

    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    const columns = useMemo(
        () =>
            Kaga.defineColumns<(typeof personnel)[0]>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: "Name",
                    cell: (ctx) => (
                        <Link
                            href={route("/main/[slug]/admin/access/[person_id]", {
                                slug: organization.slug,
                                person_id: ctx.row.original.id,
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("email", {
                    header: "Email",
                    cell: (ctx) => (
                        <Link
                            href={route("/main/[slug]/admin/access/[person_id]", {
                                slug: organization.slug,
                                person_id: ctx.row.original.id,
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("roles", {
                    header: "Roles",
                    cell: (ctx) =>
                        ctx.row.original.roles
                            .map((role) => OrganizationRole.displayNames[role])
                            .join(", "),
                    enableSorting: false,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("accessStatus", {
                    header: "Status",
                    cell: (ctx) => ctx.getValue(),
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    filterFn: Kaga.filterFns.oneOf,
                    meta: {
                        columnOptions: [
                            { label: "Joined", value: "Joined" },
                            { label: "Invited", value: "Invited" },
                            { label: "None", value: "None" },
                        ],
                    },
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
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Access Control</Saratoga.Title>
                <Saratoga.Actions>
                    <Protect orgId={organization.id} permissions={{ invitation: ["create"] }}>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(true)}>
                            <SendIcon /> Invite
                        </Button>
                    </Protect>
                </Saratoga.Actions>
            </Saratoga.Header>
            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>
            <AdminModule_CreateInvitation_Dialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
            />
        </Saratoga.Root>
    );
}
