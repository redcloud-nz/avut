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
import { Std } from "@/components/blocks/std";
import { D4HTeamLink } from "@/components/entity-links/d4h-team-link";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

/** The D4H teams the viewer's personal token can reach, each linking to its team index. */
export function D4HModule_Teams_List() {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: teams } = useSuspenseQuery(
        trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }),
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<(typeof teams)[number]>((columnHelper) => [
                columnHelper.accessor("title", {
                    header: "Name",
                    cell: (ctx) => <D4HTeamLink team={ctx.row.original} />,
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
            ]),
        [],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: teams,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "title", desc: false }],
        },
    });

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H", href: route("/orgs/[slug]/d4h", { slug }) },
                    { label: "Teams" },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Teams</Saratoga.Title>
                    </Saratoga.Header>
                    <div>
                        <Kaga.TableToolbar table={table} />
                        <Kaga.Table table={table} />
                        <Kaga.TablePagination table={table} />
                    </div>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
