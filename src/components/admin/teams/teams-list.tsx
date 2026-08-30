/*
 *  Copyright (c) 2025 A.V.U.T. Project.
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
import { Protect } from "@/components/protect";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { TeamData } from "@/lib/schemas/team";

import { trpc } from "@/trpc/client";

import { AdminModule_CreateTeam_Dialog } from "./create-team";

/**
 * List of teams in the organization.
 */
export function AdminModule_TeamsList() {
    const organization = useOrganization();

    const { data: teams } = useSuspenseQuery(
        trpc.teams.listTeams.queryOptions({
            organizationId: organization.id,
        }),
    );

    type RowData = TeamData;

    const columns = useMemo(
        () =>
            Kaga.defineColumns<RowData>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: "Name",
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/admin/teams/[team_id]", {
                                slug: organization.slug,
                                team_id: ctx.row.original.id,
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("description", {
                    header: "Description",
                    cell: (ctx) => ctx.getValue(),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
            ]),
        [organization.slug],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: teams,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        globalFilterFn: "includesString",
        initialState: {
            sorting: [{ id: "name", desc: false }],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Teams</Saratoga.Title>
                <Saratoga.Actions>
                    <Protect permissions={{ team: ["create"] }}>
                        <AdminModule_CreateTeam_Dialog />
                    </Protect>
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
