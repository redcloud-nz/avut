/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views/equipment/categories
 */
"use client";

import { useMemo } from "react";

import { useLiveSuspenseQuery } from "@tanstack/react-db";
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
import Link from "next/link";

import { useOrganization } from "@/hooks/use-organization";
import { getD4HMembersCollection } from "@/lib/collections/d4h-members";
import { route } from "@/lib/routes";

export default function D4HViewsModule_Members_Page() {
    const organization = useOrganization();

    const { data: members } = useLiveSuspenseQuery((q) =>
        q.from({
            member: getD4HMembersCollection(organization.id),
        }),
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<(typeof members)[number]>((columnHelper) => [
                columnHelper.accessor("id", {
                    header: "Member ID",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: false,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("name", {
                    header: "Name",
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/d4h-views/members/[team_id]/[member_id]", {
                                slug: organization.slug,
                                team_id: String(ctx.row.original.team.id),
                                member_id: String(ctx.row.original.id),
                            })}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("team.title", {
                    header: "Team",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
            ]),
        [organization.slug],
    );

    const table = useReactTable({
        data: members,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            pagination: {
                pageIndex: 0,
                pageSize: Kaga.DEFAULT_PAGE_SIZE,
            },
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "D4H Views",
                        href: route("/orgs/[slug]/d4h-views", { slug: organization.slug }),
                    },
                    "Members",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Members</Saratoga.Title>
                    </Saratoga.Header>
                    <div>
                        <Kaga.TableToolbar table={table} />
                        <Kaga.Table table={table} />
                        <Kaga.TablePagination table={table} />
                    </div>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
