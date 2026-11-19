/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useMemo, type ReactNode } from "react";

import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { TablePseudoQuery } from "@/components/blocks/table-pseudo-query";
import { PersonLink } from "@/components/entity-links/person-link";
import { useOrganization } from "@/hooks/use-organization";
import { D4HMemberStatus, formatD4HMemberStatus } from "@/lib/schemas/d4h/member";
import { TeamData } from "@/lib/schemas/team";
import { RouterOutput } from "@/trpc/client";

import { D4HMemberStatusBadge } from "./d4h-member-status-badge";
import { MembershipSourceBadge } from "./membership-source-badge";

export type Teams_MembershipRow = RouterOutput["teams"]["listTeamMemberships"][number];

// D4H columns don't fit at phone width — hide them below `md`; Name and the
// row action stay visible. Filters remain reachable in the toolbar menu.
const hideBelowMd = {
    headerProps: { className: "hidden md:table-cell" },
    cellProps: { className: "hidden md:table-cell" },
} as const;

interface Teams_Members_TableProps {
    team: TeamData;
    memberships: Teams_MembershipRow[];
    /** The last column's content for each row. Pass a stable function (`useCallback`): it's a column dependency. */
    rowAction: (row: Teams_MembershipRow) => ReactNode;
    /** Render names as links to org admin's person pages (default), or as plain text. */
    linkPeople?: boolean;
}

export function Teams_Members_Table({
    team,
    memberships,
    rowAction,
    linkPeople = true,
}: Teams_Members_TableProps) {
    const organization = useOrganization();

    const teamIsD4HLinked = team.d4h != null;
    const lastSyncedAt = team.d4h?.lastSyncedAt ?? null;

    const columns = useMemo(
        () =>
            Kaga.defineColumns<Teams_MembershipRow>((columnHelper) => [
                columnHelper.accessor((row) => `${row.person.name} ${row.person.email}`, {
                    id: "name",
                    header: "Name",
                    cell: (ctx) =>
                        linkPeople ? (
                            <PersonLink person={ctx.row.original.person} />
                        ) : (
                            ctx.row.original.person.name
                        ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                teamIsD4HLinked
                    ? columnHelper.accessor((row) => row.d4h?.d4hPosition ?? "", {
                          id: "d4hPosition",
                          header: "D4H Position",
                          cell: (ctx) => ctx.row.original.d4h?.d4hPosition || "—",
                          enableSorting: true,
                          enableColumnFilter: false,
                          enableGlobalFilter: false,
                          meta: hideBelowMd,
                      })
                    : null,
                teamIsD4HLinked
                    ? columnHelper.accessor((row) => row.d4h?.d4hStatus ?? "", {
                          id: "d4hStatus",
                          header: "D4H Status",
                          cell: (ctx) =>
                              ctx.row.original.d4h ? (
                                  <D4HMemberStatusBadge status={ctx.row.original.d4h.d4hStatus} />
                              ) : (
                                  "—"
                              ),
                          enableSorting: false,
                          enableColumnFilter: true,
                          enableGlobalFilter: false,
                          filterFn: Kaga.filterFns.oneOf,
                          meta: {
                              ...hideBelowMd,
                              columnOptions: D4HMemberStatus.values.map((value) => ({
                                  label: formatD4HMemberStatus(value),
                                  value,
                              })),
                          },
                      })
                    : null,
                teamIsD4HLinked
                    ? columnHelper.display({
                          id: "source",
                          header: "Source",
                          cell: (ctx) => (
                              <MembershipSourceBadge
                                  membership={ctx.row.original}
                                  teamIsD4HLinked
                                  lastSyncedAt={lastSyncedAt}
                              />
                          ),
                          meta: hideBelowMd,
                      })
                    : null,
                teamIsD4HLinked
                    ? columnHelper.accessor("status", {
                          id: "recordStatus",
                          header: "Status",
                          cell: (ctx) => ctx.getValue(),
                          enableSorting: false,
                          enableColumnFilter: true,
                          enableGlobalFilter: false,
                          filterFn: Kaga.filterFns.oneOf,
                          meta: {
                              ...hideBelowMd,
                              columnOptions: [
                                  { label: "Active", value: "Active" },
                                  { label: "Archived", value: "Archived" },
                              ],
                          },
                      })
                    : null,
                columnHelper.display({
                    id: "actions",
                    header: "",
                    cell: (ctx) => rowAction(ctx.row.original),
                    enableHiding: false,
                    meta: { cellProps: { className: "w-9 p-0" } },
                }),
            ]),
        [teamIsD4HLinked, lastSyncedAt, rowAction, linkPeople],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable<Teams_MembershipRow>({
        data: memberships,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        globalFilterFn: "includesString",
        initialState: {
            columnFilters: teamIsD4HLinked ? [{ id: "recordStatus", value: ["Active"] }] : [],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "name", desc: false }],
        },
    });

    return (
        <div>
            <Kaga.TableToolbar
                table={table}
                query={
                    <TablePseudoQuery
                        table={table}
                        config={{
                            table: "Team_Memberships",
                            joins: [
                                { table: "Personnel", on: "PersonId" },
                                ...(teamIsD4HLinked
                                    ? [
                                          {
                                              table: "Team_Membership_D4H",
                                              on: "TeamMembershipId",
                                          },
                                      ]
                                    : []),
                            ],
                            extraWhere: [
                                `OrganizationId = '${organization.id}'`,
                                `TeamId = '${team.id}'`,
                            ],
                        }}
                    />
                }
            />
            <Kaga.Table table={table} />
            <Kaga.TablePagination table={table} />
        </div>
    );
}
