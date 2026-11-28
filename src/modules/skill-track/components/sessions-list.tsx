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
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";

import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { useScopedRoute } from "@/hooks/use-scoped-route";
import { PersonRef } from "@/lib/schemas/person";
import { SKILL_CHECK_STATUS_LABELS } from "@/lib/schemas/skill-check";
import { SkillCheckSession } from "@/lib/schemas/skill-check-session";
import { TeamId, TeamRef } from "@/lib/schemas/team";
import { useFormatSessionWhen } from "@/modules/skill-track/lib/use-format-session-when";
import { trpc } from "@/trpc/client";

import { SkillTrack_CreateSession_Dialog } from "./create-session";
import { NO_SESSION_TEAM } from "./session-when-picker";

/**
 * The organisation's skill check sessions. With `teamId` (team scope), only that team's sessions.
 */
export default function SkillTrack_Sessions_List({ teamId }: { teamId?: TeamId } = {}) {
    const organization = useOrganization();
    const scopedRoute = useScopedRoute();
    const { formatDate } = usePreferences();
    const formatSessionWhen = useFormatSessionWhen();

    const { data: sessions } = useSuspenseQuery(
        trpc.skillCheckSessions.listSessions.queryOptions({
            organizationId: organization.id,
            teamId,
        }),
    );

    type RowData = SkillCheckSession & { assessors: PersonRef[]; team: TeamRef | null };

    const teamOptions = useMemo(() => {
        const teams = new Map<TeamRef["id"], string>();
        for (const session of sessions) {
            if (session.team) teams.set(session.team.id, session.team.name);
        }
        const options: { label: string; value: TeamRef["id"] | typeof NO_SESSION_TEAM }[] = [
            ...[...teams]
                .map(([value, label]) => ({ label, value }))
                .sort((a, b) => a.label.localeCompare(b.label)),
            { label: "No team", value: NO_SESSION_TEAM },
        ];
        return options;
    }, [sessions]);

    const columns = useMemo(
        () =>
            Kaga.defineColumns<RowData>((columnHelper) => [
                columnHelper.accessor("name", {
                    header: "Name",
                    cell: (ctx) => (
                        <Link
                            href={scopedRoute(
                                {
                                    organization: "/orgs/[slug]/skill-track/sessions/[session_id]",
                                    team: "/teams/[slug]/skill-track/sessions/[session_id]",
                                },
                                { session_id: ctx.row.original.id },
                            )}
                        >
                            {ctx.getValue() || ctx.row.original.id}
                        </Link>
                    ),
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor((row) => row.team?.id ?? NO_SESSION_TEAM, {
                    id: "team",
                    header: "Team",
                    cell: (ctx) => ctx.row.original.team?.name ?? "—",
                    enableSorting: false,
                    enableGlobalFilter: false,
                    enableColumnFilter: true,
                    filterFn: Kaga.filterFns.oneOf,
                    meta: { columnOptions: teamOptions },
                }),
                columnHelper.accessor("startsAt", {
                    header: "When",
                    cell: (ctx) => formatSessionWhen(ctx.getValue(), ctx.row.original.endsAt),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor((row) => row.assessors.map((a) => a.name).join(", "), {
                    id: "assessor",
                    header: "Assessor",
                    cell: (ctx) => ctx.getValue() || "—",
                    enableSorting: false,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("updatedAt", {
                    header: "Updated",
                    cell: (ctx) => formatDate(ctx.getValue()),
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
                columnHelper.accessor("status", {
                    header: "Status",
                    cell: (ctx) => SKILL_CHECK_STATUS_LABELS[ctx.getValue()] ?? ctx.getValue(),
                    enableColumnFilter: true,
                    enableSorting: false,
                    enableGlobalFilter: false,
                    filterFn: Kaga.filterFns.oneOf,
                    meta: {
                        columnOptions: [
                            { label: "Draft", value: "Draft" },
                            { label: "Approved", value: "Include" },
                            { label: "Excluded", value: "Exclude" },
                        ],
                    },
                }),
            ]),
        [scopedRoute, formatDate, formatSessionWhen, teamOptions],
    );

    // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns non-memoizable functions
    const table = useReactTable({
        data: sessions,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            columnFilters: [{ id: "status", value: ["Draft", "Include", "Exclude"] }],
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "updatedAt", desc: true }],
        },
    });

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>Skill Check Sessions</Saratoga.Title>
                <Saratoga.Actions>
                    <Protect permissions={{ skillCheckSession: ["create"] }}>
                        <SkillTrack_CreateSession_Dialog />
                    </Protect>
                </Saratoga.Actions>
            </Saratoga.Header>
            <Show
                when={sessions.length > 0}
                fallback={
                    <Empty>
                        <EmptyHeader>No sessions found</EmptyHeader>
                        <EmptyDescription>
                            No skill check sessions have been created yet.
                        </EmptyDescription>
                    </Empty>
                }
            >
                <div>
                    <Kaga.TableToolbar table={table} />
                    <Kaga.Table table={table} />
                    <Kaga.TablePagination table={table} />
                </div>
            </Show>
        </Saratoga.Root>
    );
}
