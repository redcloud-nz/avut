/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import * as R from "remeda";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";

import { ChevronDownIcon } from "lucide-react";

import { Glorious } from "@/components/blocks/glorious";
import {
    ReportNavbar,
    SkillTrack_ReportSkillScopePicker,
} from "@/components/skill-track/reports/report-scope-picker";
import { deriveStatus, StatusBadge } from "@/components/skill-track/reports/competency-status";
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
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

const stickyFirstCol = "sticky left-0 z-10 bg-background";
const headCell =
    "h-9 border-b bg-background px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide";

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

    const rows = R.pipe(
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
        R.sortBy((row) => row.name),
    );

    const currentTeamValue = teamId ?? "all";
    const scopeLabel = teamId
        ? (teams.find((team) => team.id === teamId)?.name ?? "Team")
        : "Whole Organization";

    return (
        <>
            <ReportNavbar routePattern="/orgs/[slug]/skill-track/reports/skill" />
            <Glorious.Root>
                <Glorious.Header>
                    <div>
                        <Glorious.Title>{skill ? skill.name : "Skill Coverage"}</Glorious.Title>
                        <Glorious.Subtitle>
                            {rows.length} {rows.length === 1 ? "person" : "people"} · {scopeLabel}
                        </Glorious.Subtitle>
                    </div>
                    <Glorious.Actions>
                        {syntheticActions}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    {scopeLabel}
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
                                            <DropdownMenuRadioItem key={team.id} value={team.id}>
                                                {team.name}
                                            </DropdownMenuRadioItem>
                                        )),
                                    )}
                                </DropdownMenuRadioGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </Glorious.Actions>
                </Glorious.Header>

                {!skill ? (
                    <Empty>
                        <EmptyDescription>
                            That skill is not in any of this organization&apos;s subscribed
                            packages.
                        </EmptyDescription>
                    </Empty>
                ) : rows.length === 0 ? (
                    <Empty>
                        <EmptyDescription>
                            There are no active personnel in this scope.
                        </EmptyDescription>
                    </Empty>
                ) : (
                    <Glorious.ScrollFrame>
                        <Glorious.Table className="w-full">
                            <colgroup>
                                <col className="w-[60%] sm:w-[50%]" />
                                <col className="w-[40%] sm:w-[25%]" />
                                <col className="hidden sm:table-column sm:w-[25%]" />
                            </colgroup>
                            <Glorious.TableHeader>
                                <th
                                    className={cn(
                                        stickyFirstCol,
                                        headCell,
                                        "top-0 z-30 border-r text-left",
                                    )}
                                >
                                    Name
                                </th>
                                <th
                                    className={cn(
                                        headCell,
                                        "sticky top-0 z-20 text-center sm:border-r",
                                    )}
                                >
                                    Status
                                </th>
                                <th
                                    className={cn(
                                        headCell,
                                        "sticky top-0 z-20 hidden text-center sm:table-cell",
                                    )}
                                >
                                    Last Checked
                                </th>
                            </Glorious.TableHeader>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id} className="hover:bg-muted/40">
                                        <th
                                            scope="row"
                                            className={cn(
                                                stickyFirstCol,
                                                "truncate border-r border-b px-3 py-1.5 text-left align-middle font-normal",
                                            )}
                                            title={row.name}
                                        >
                                            {row.name}
                                        </th>
                                        <td className="border-b px-3 py-1.5 text-center align-middle sm:border-r">
                                            <StatusBadge status={row.status} />
                                        </td>
                                        <td className="hidden border-b px-3 py-1.5 text-center align-middle text-sm text-muted-foreground tabular-nums sm:table-cell">
                                            {row.checkedAt ? formatDate(row.checkedAt) : "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Glorious.Table>
                    </Glorious.ScrollFrame>
                )}
            </Glorious.Root>
        </>
    );
}
