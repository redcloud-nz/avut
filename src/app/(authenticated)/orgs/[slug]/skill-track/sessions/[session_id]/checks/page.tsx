/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/sessions/[session_id]/checks
 */

"use client";

import { ClipboardCheckIcon } from "lucide-react";
import { use, useMemo } from "react";

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
import { Show } from "@/components/show";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillId, SkillRef } from "@/lib/schemas/skill";
import { SkillCheck } from "@/lib/schemas/skill-check";
import { trpc } from "@/trpc/client";

import { SKILL_CHECK_RESULT_LABELS, SKILL_CHECK_STATUS_LABELS } from "@/lib/schemas/skill-check";

export default function SkillTrack_SessionChecks_Page(
    props: PageProps<"/orgs/[slug]/skill-track/sessions/[session_id]/checks">,
) {
    const { slug, session_id } = use(props.params);

    const organization = useOrganization();

    const [
        { data: session },
        { data: assessees },
        { data: assessors },
        { data: skills },
        { data: skillChecks },
    ] = useSuspenseQueries({
        queries: [
            trpc.skills.getSession.queryOptions({
                organizationId: organization.id,
                skillCheckSessionId: session_id,
            }),
            trpc.skills.listSessionAssessees.queryOptions({
                organizationId: organization.id,
                sessionId: session_id,
                scope: "all",
            }),
            trpc.skills.listSessionAssessors.queryOptions({
                organizationId: organization.id,
                sessionId: session_id,
                scope: "all",
            }),
            trpc.skills.listSessionSkills.queryOptions({
                organizationId: organization.id,
                sessionId: session_id,
                scope: "all",
            }),
            trpc.skillChecks.listSkillChecks.queryOptions({
                organizationId: organization.id,
                sessionId: session_id,
            }),
        ],
    });

    const assesseeById = useMemo(
        () => new Map<PersonId, PersonRef>(assessees.map((p) => [p.id, p])),
        [assessees],
    );
    const assessorById = useMemo(
        () => new Map<PersonId, PersonRef>(assessors.map((p) => [p.id, p])),
        [assessors],
    );
    const skillById = useMemo(
        () => new Map<SkillId, SkillRef>(skills.map((s) => [s.id, s])),
        [skills],
    );

    type Row = SkillCheck;

    const columns = useMemo(
        () =>
            Kaga.defineColumns<Row>((col) => [
                col.accessor((row) => assesseeById.get(row.assesseeId)?.name ?? row.assesseeId, {
                    id: "assessee",
                    header: "Assessee",
                    enableColumnFilter: false,
                    enableGlobalFilter: true,
                    enableHiding: false,
                    enableSorting: true,
                }),
                col.accessor((row) => skillById.get(row.skillId)?.name ?? row.skillId, {
                    id: "skill",
                    header: "Skill",
                    enableColumnFilter: false,
                    enableGlobalFilter: true,
                    enableHiding: false,
                    enableSorting: true,
                }),
                col.accessor("result", {
                    header: "Result",
                    cell: (ctx) => SKILL_CHECK_RESULT_LABELS[ctx.getValue()] ?? ctx.getValue(),
                    enableColumnFilter: true,
                    enableGlobalFilter: false,
                    enableHiding: false,
                    enableSorting: false,
                    filterFn: Kaga.filterFns.oneOf,
                    meta: {
                        columnOptions: Object.entries(SKILL_CHECK_RESULT_LABELS).map(
                            ([value, label]) => ({
                                label,
                                value,
                            }),
                        ),
                    },
                }),
                col.accessor((row) => assessorById.get(row.assessorId)?.name ?? row.assessorId, {
                    id: "assessor",
                    header: "Assessor",
                    enableColumnFilter: false,
                    enableGlobalFilter: true,
                    enableHiding: true,
                    enableSorting: true,
                }),
                col.accessor("status", {
                    header: "Status",
                    cell: (ctx) => SKILL_CHECK_STATUS_LABELS[ctx.getValue()] ?? ctx.getValue(),
                    enableColumnFilter: true,
                    enableGlobalFilter: false,
                    enableHiding: true,
                    enableSorting: false,
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
        [assesseeById, assessorById, skillById],
    );

    const table = useReactTable({
        data: skillChecks,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
            sorting: [{ id: "assessee", desc: false }],
            columnVisibility: {
                assessor: false,
                status: false,
            },
        },
    });

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Skill Track", href: route("/orgs/[slug]/skill-track", { slug }) },
                    {
                        label: "Sessions",
                        href: route("/orgs/[slug]/skill-track/sessions", { slug }),
                    },
                    {
                        label: session.name || session.id,
                        href: route("/orgs/[slug]/skill-track/sessions/[session_id]", {
                            slug,
                            session_id,
                        }),
                    },
                    "Checks",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>
                            Skill checks recorded in {session.name || session.id}
                        </Saratoga.Title>
                    </Saratoga.Header>
                    <Show
                        when={skillChecks.length > 0}
                        fallback={
                            <Empty>
                                <EmptyMedia>
                                    <ClipboardCheckIcon className="size-12 text-muted-foreground" />
                                </EmptyMedia>
                                <EmptyDescription>
                                    No skill checks have been recorded for this session yet.
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
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
