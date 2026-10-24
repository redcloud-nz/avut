/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { notFound } from "next/navigation";
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
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HMember, formatD4HMemberStatus } from "@/lib/schemas/d4h/member";
import { trpc } from "@/trpc/client";

import { D4HModule_TeamPickerDialog } from "../teams/team-picker-dialog";

/** One D4H team's members, with Change team to see another team's. */
export function D4HModule_TeamMembers_List({ teamId }: { teamId: number }) {
    const organization = useOrganization();
    const { slug } = organization;

    const { data: teams } = useSuspenseQuery(
        trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }),
    );

    // Check the team before reading its members, so an unknown team shows the not-found panel.
    const team = teams.find((t) => t.id === teamId);
    if (!team) notFound();

    const { data: members } = useSuspenseQuery(
        trpc.d4hApi.listTeamMembers.queryOptions({ organizationId: organization.id, teamId }),
    );

    const columns = useMemo(
        () =>
            Kaga.defineColumns<D4HMember>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: "Name",
                    cell: (ctx) => (
                        <Link
                            href={route(
                                "/orgs/[slug]/d4h/teams/[d4h_team_id]/members/[member_id]",
                                {
                                    slug,
                                    d4h_team_id: String(teamId),
                                    member_id: String(ctx.row.original.id),
                                },
                            )}
                        >
                            {ctx.getValue()}
                        </Link>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("ref", {
                    header: "Ref",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("position", {
                    header: "Position",
                    cell: (ctx) => ctx.getValue(),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("status", {
                    header: "Status",
                    cell: (ctx) => formatD4HMemberStatus(ctx.getValue()),
                    filterFn: Kaga.filterFns.oneOf,
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    meta: {
                        // `listTeamMembers` returns only these two.
                        columnOptions: (["OPERATIONAL", "NON_OPERATIONAL"] as const).map(
                            (value) => ({ value, label: formatD4HMemberStatus(value) }),
                        ),
                    },
                }),
            ]),
        [slug, teamId],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: members,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        initialState: {
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "D4H", href: route("/orgs/[slug]/d4h", { slug }) },
                    { label: "Teams", href: route("/orgs/[slug]/d4h/teams", { slug }) },
                    {
                        label: team.title,
                        href: route("/orgs/[slug]/d4h/teams/[d4h_team_id]", {
                            slug,
                            d4h_team_id: String(team.id),
                        }),
                    },
                    { label: "Members" },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Members</Saratoga.Title>
                        {teams.length > 1 && (
                            <Saratoga.Actions>
                                <D4HModule_TeamPickerDialog
                                    section={(id) =>
                                        route("/orgs/[slug]/d4h/teams/[d4h_team_id]/members", {
                                            slug,
                                            d4h_team_id: String(id),
                                        })
                                    }
                                />
                            </Saratoga.Actions>
                        )}
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
