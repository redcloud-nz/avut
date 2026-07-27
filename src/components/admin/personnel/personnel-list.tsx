/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
import { CreateNewIcon } from "@/components/icons";
import { Protect } from "@/components/protect";

import { Button } from "@/components/ui/button";

import { route } from "@/lib/routes";
import { OrganizationData } from "@/lib/schemas/organization";
import { PersonData } from "@/lib/schemas/person";
import { trpc } from "@/trpc/client";

import { AdminModule_CreatePerson_Dialog } from "./create-person";

interface AdminModule_PersonnelListProps {
    organization: OrganizationData;
}

/**
 * List of personnel in the organization.
 */
export function AdminModule_PersonnelList({ organization }: AdminModule_PersonnelListProps) {
    const { data: personnel } = useSuspenseQuery(
        trpc.personnel.listPersonnel.queryOptions({
            organizationId: organization.id,
        }),
    );

    type RowData = PersonData;

    const columns = useMemo(
        () =>
            Kaga.defineColumns<RowData>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: "Name",
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/admin/personnel/[person_id]", {
                                slug: organization.slug,
                                person_id: ctx.row.original.id,
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableColumnFilter: false,
                    enableGlobalFilter: true,
                    enableSorting: true,
                }),
                columnHelper.accessor("email", {
                    header: "Email",
                    cell: (ctx) => ctx.getValue(),
                    enableColumnFilter: false,
                    enableGlobalFilter: true,
                    enableSorting: true,
                }),
                columnHelper.accessor("status", {
                    header: "Status",
                    cell: (ctx) => ctx.getValue(),
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    filterFn: Kaga.filterFns.oneOf,
                    meta: {
                        columnOptions: [
                            { label: "Active", value: "Active" },
                            { label: "Archived", value: "Archived" },
                        ],
                    },
                }),
            ]),
        [organization.slug],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable<RowData>({
        columns,
        data: personnel,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            columnFilters: [{ id: "status", value: ["Active"] }],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "name", desc: false }],
        },
    });

    const [createPersonDialogOpen, setCreatePersonDialogOpen] = useState(false);

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Personnel</Saratoga.Title>
                <Saratoga.Actions>
                    <Protect orgId={organization.id} permissions={{ person: ["create"] }}>
                        <Button variant="outline" onClick={() => setCreatePersonDialogOpen(true)}>
                            <CreateNewIcon /> <span className="hidden md:inline">New Person</span>
                        </Button>
                    </Protect>
                </Saratoga.Actions>
            </Saratoga.Header>

            <div>
                <Kaga.TableToolbar table={table} />
                <Kaga.Table table={table} />
                <Kaga.TablePagination table={table} />
            </div>

            <AdminModule_CreatePerson_Dialog
                open={createPersonDialogOpen}
                onOpenChange={setCreatePersonDialogOpen}
            />
        </Saratoga.Root>
    );
}
