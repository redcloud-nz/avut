/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";
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
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";

import { useOrganization } from "@/hooks/use-organization";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { route } from "@/lib/routes";
import { D4HMemberStatus, formatD4HMemberStatus } from "@/lib/schemas/d4h/member";
import { TeamId } from "@/lib/schemas/team";
import { RouterOutput, trpc } from "@/trpc/client";

import { AdminModule_AddTeamMember_Dialog } from "./add-team-member";
import { D4HMemberStatusBadge } from "./d4h-member-status-badge";
import { MembershipSourceBadge } from "./membership-source-badge";
import { AdminModule_RemoveTeamMember_Dialog } from "./remove-team-member";

type MembershipRow = RouterOutput["teams"]["listTeamMemberships"][number];

export function AdminModule_Team_Personnel_Content({ teamId }: { teamId: TeamId }) {
    const organization = useOrganization();

    const [{ data: team }, { data: teamMembers }] = useSuspenseQueries({
        queries: [
            trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
            trpc.teams.listTeamMemberships.queryOptions({
                organizationId: organization.id,
                teamId,
            }),
        ],
    });

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["remove-member"] as const),
    );
    const [memberId, setMemberId] = useQueryState("memberId", parseAsString);

    const activeMember = teamMembers.find((tm) => tm.personId === memberId) ?? null;

    function openRemoveMember(id: string) {
        void setMemberId(id, { history: "push" });
        void setAction("remove-member", { history: "push" });
    }

    function closeRemoveMember() {
        void setAction(null, { history: "replace" });
        void setMemberId(null, { history: "replace" });
    }

    const teamIsD4HLinked = team.d4h != null;
    const lastSyncedAt = team.d4h?.lastSyncedAt ?? null;

    const columns = useMemo(
        () =>
            Kaga.defineColumns<MembershipRow>((columnHelper) => [
                columnHelper.accessor((row) => `${row.person.name} ${row.person.email}`, {
                    id: "name",
                    header: "Name",
                    cell: (ctx) => (
                        <Link
                            href={route("/orgs/[slug]/admin/personnel/[person_id]", {
                                slug: organization.slug,
                                person_id: ctx.row.original.person.id,
                            })}
                        >
                            <div>{ctx.row.original.person.name}</div>
                            <div className="text-muted-foreground text-xs">
                                {ctx.row.original.person.email}
                            </div>
                        </Link>
                    ),
                    enableGlobalFilter: true,
                    enableSorting: true,
                    enableColumnFilter: false,
                }),
                teamIsD4HLinked
                    ? columnHelper.accessor((row) => row.d4h?.d4hPosition ?? "", {
                          id: "position",
                          header: "Position",
                          cell: (ctx) => ctx.row.original.d4h?.d4hPosition || "—",
                          enableSorting: true,
                          enableColumnFilter: false,
                          enableGlobalFilter: false,
                      })
                    : null,
                teamIsD4HLinked
                    ? columnHelper.accessor((row) => row.d4h?.d4hStatus ?? "", {
                          id: "status",
                          header: "Status",
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
                      })
                    : null,
                teamIsD4HLinked
                    ? columnHelper.accessor("status", {
                          id: "recordStatus",
                          header: "Membership",
                          cell: (ctx) => ctx.getValue(),
                          enableSorting: false,
                          enableColumnFilter: true,
                          enableGlobalFilter: false,
                          filterFn: Kaga.filterFns.oneOf,
                          meta: {
                              columnOptions: [
                                  { label: "Active", value: "Active" },
                                  { label: "Archived", value: "Archived" },
                              ],
                          },
                      })
                    : null,
                columnHelper.accessor("createdAt", {
                    header: "Joined",
                    cell: (ctx) => (
                        <span title={formatDateTime(ctx.getValue())}>
                            {formatRelativeDateTime(ctx.getValue())}
                        </span>
                    ),
                    enableSorting: true,
                    enableColumnFilter: false,
                    enableGlobalFilter: false,
                }),
                columnHelper.display({
                    id: "actions",
                    header: "",
                    cell: (ctx) => (
                        <Protect permissions={{ team: ["update"] }}>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openRemoveMember(ctx.row.original.personId)}
                            >
                                <ObjectIcons.Delete />
                            </Button>
                        </Protect>
                    ),
                    enableHiding: false,
                    meta: { cellProps: { className: "w-9 p-0" } },
                }),
            ]),
        // openRemoveMember is a stable closure over setState setters
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [organization.slug, teamIsD4HLinked, lastSyncedAt],
    );

    const table = useReactTable<MembershipRow>({
        data: teamMembers,
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
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Admin",
                        href: route("/orgs/[slug]/admin", { slug: organization.slug }),
                    },
                    {
                        label: "Teams",
                        href: route("/orgs/[slug]/admin/teams", { slug: organization.slug }),
                    },
                    {
                        label: team.name,
                        href: route("/orgs/[slug]/admin/teams/[team_id]", {
                            slug: organization.slug,
                            team_id: teamId,
                        }),
                    },
                    "Personnel",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Members of {team.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <Protect permissions={{ team: ["update"] }}>
                                <AdminModule_AddTeamMember_Dialog team={team} />
                            </Protect>
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <div>
                        <Kaga.TableToolbar table={table} />
                        <Kaga.Table table={table} />
                        <Kaga.TablePagination table={table} />
                    </div>

                    {activeMember && (
                        <AdminModule_RemoveTeamMember_Dialog
                            organizationId={organization.id}
                            team={team}
                            person={activeMember.person}
                            open={action === "remove-member"}
                            onOpenChange={(open) => (open ? undefined : closeRemoveMember())}
                        />
                    )}
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
