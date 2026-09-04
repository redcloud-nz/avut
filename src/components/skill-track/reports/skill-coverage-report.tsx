/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useMemo } from "react";
import * as R from "remeda";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table";
import { useQueryState } from "nuqs";

import { ChevronDownIcon } from "lucide-react";

import { Kaga } from "@/components/blocks/kaga";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import {
    ReportNavbar,
    SkillTrack_ReportSkillScopePicker,
} from "@/components/skill-track/reports/report-scope-picker";
import {
    deriveStatus,
    STATUS_LABELS,
    StatusBadge,
    type CompetencyStatus,
} from "@/components/skill-track/reports/competency-status";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSyntheticCompetencies } from "@/components/skill-track/reports/synthetic-competency-data";
import { Empty, EmptyDescription } from "@/components/ui/empty";

import { useOrganization } from "@/hooks/use-organization";
import { formatDate } from "@/lib/datetime";
import { SkillId } from "@/lib/schemas/skill";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

const STATUS_RANK: Record<CompetencyStatus, number> = {
    "not-competent": 3,
    expired: 2,
    "not-assessed": 1,
    current: 0,
};

export function SkillTrack_SkillCoverageReport() {
    const [skillParam] = useQueryState("skill");
    const parsedSkillId = skillParam ? SkillId.schema.safeParse(skillParam) : undefined;

    // An absent — or malformed — `?skill=` means "nothing picked yet"; show the picker rather
    // than falling through to a full-org competency matrix.
    if (!parsedSkillId?.success) {
        return (
            <SkillTrack_ReportSkillScopePicker routePattern="/orgs/[slug]/skill-track/reports/skill" />
        );
    }

    return <SkillCoverageReportView skillId={parsedSkillId.data} />;
}

function SkillCoverageReportView({ skillId }: { skillId: SkillId }) {
    const organization = useOrganization();

    const [teamParam, setTeamParam] = useQueryState("team");

    const parsedTeamId = teamParam ? TeamId.schema.safeParse(teamParam) : undefined;
    const teamId = parsedTeamId?.success ? parsedTeamId.data : undefined;

    const { data: teams } = useSuspenseQuery(
        trpc.teams.listTeams.queryOptions({ organizationId: organization.id }),
    );

    const {
        data: { personnel, skills, competencies: recordedCompetencies },
    } = useSuspenseQuery(
        trpc.skillChecks.getCompetencyMatrix.queryOptions({
            organizationId: organization.id,
            skillId,
            teamId,
        }),
    );

    const { competencies, syntheticActions } = useSyntheticCompetencies(
        skills,
        personnel,
        recordedCompetencies,
    );

    const skill = skills.find((candidate) => candidate.id === skillId);

    const competencyByAssessee = new Map(
        competencies.map((competency) => [competency.assesseeId, competency]),
    );

    type Row = {
        id: string;
        name: string;
        status: CompetencyStatus;
        checkedAt: string | null;
    };

    const data = useMemo<Row[]>(() => {
        if (!skill) return [];
        return R.pipe(
            personnel,
            R.map((person) => {
                const competency = competencyByAssessee.get(person.id);
                return {
                    id: person.id,
                    name: person.name,
                    status: deriveStatus(competency),
                    checkedAt: competency?.checkedAt ?? null,
                };
            }),
            R.sortBy([(row) => STATUS_RANK[row.status], "desc"], [(row) => row.name, "asc"]),
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps -- derived purely from the query data
    }, [personnel, competencies, skill]);

    const columns = useMemo(
        () =>
            Kaga.defineColumns<Row>((col) => [
                col.accessor("name", {
                    header: "Name",
                    enableSorting: true,
                    enableGlobalFilter: true,
                    enableColumnFilter: false,
                }),
                col.accessor("status", {
                    header: "Status",
                    cell: (ctx) => <StatusBadge status={ctx.getValue()} />,
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: true,
                    sortingFn: (a, b) =>
                        STATUS_RANK[a.original.status] - STATUS_RANK[b.original.status],
                    filterFn: Kaga.filterFns.oneOf,
                    meta: {
                        columnOptions: (Object.keys(STATUS_LABELS) as CompetencyStatus[]).map(
                            (status) => ({ label: STATUS_LABELS[status], value: status }),
                        ),
                    },
                }),
                col.accessor("checkedAt", {
                    header: "Last Checked",
                    cell: (ctx) => {
                        const value = ctx.getValue();
                        return value ? formatDate(value) : "—";
                    },
                    enableSorting: true,
                    enableGlobalFilter: false,
                    enableColumnFilter: false,
                }),
            ]),
        [],
    );

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: {
            pagination: { pageIndex: 0, pageSize: Kaga.DEFAULT_PAGE_SIZE },
        },
    });

    const currentTeamValue = teamId ?? "all";

    return (
        <>
            <ReportNavbar routePattern="/orgs/[slug]/skill-track/reports/skill" />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{skill ? skill.name : "Skill Coverage"}</Saratoga.Title>
                        <Saratoga.Actions>
                            {syntheticActions}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline">
                                        {teamId
                                            ? (teams.find((team) => team.id === teamId)?.name ??
                                              "Team")
                                            : "Whole Organization"}
                                        <ChevronDownIcon className="size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuRadioGroup
                                        value={currentTeamValue}
                                        onValueChange={(value) =>
                                            setTeamParam(value === "all" ? null : value)
                                        }
                                    >
                                        <DropdownMenuRadioItem value="all">
                                            Whole Organization
                                        </DropdownMenuRadioItem>
                                        {R.pipe(
                                            teams,
                                            R.sortBy((team) => team.name),
                                            R.map((team) => (
                                                <DropdownMenuRadioItem
                                                    key={team.id}
                                                    value={team.id}
                                                >
                                                    {team.name}
                                                </DropdownMenuRadioItem>
                                            )),
                                        )}
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    {!skill ? (
                        <Empty>
                            <EmptyDescription>
                                That skill is not in any of this organization&apos;s subscribed
                                packages.
                            </EmptyDescription>
                        </Empty>
                    ) : (
                        <div>
                            <Kaga.TableToolbar table={table} />
                            <Kaga.Table table={table} />
                            <Kaga.TablePagination table={table} />
                        </div>
                    )}
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
