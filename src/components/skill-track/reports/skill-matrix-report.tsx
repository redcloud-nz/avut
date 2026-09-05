/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import * as R from "remeda";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";

import {
    ReportNavbar,
    SkillTrack_ReportTeamScopePicker,
} from "@/components/skill-track/reports/report-scope-picker";
import { deriveStatus, StatusIcon } from "@/components/skill-track/reports/competency-status";
import { useSyntheticCompetencies } from "@/components/skill-track/reports/synthetic-competency-data";
import {
    DiagonalColumnHeader,
    DiagonalLeadColumnHeader,
} from "@/components/ui/diagonal-column-header";
import { Empty, EmptyDescription } from "@/components/ui/empty";

import { useOrganization } from "@/hooks/use-organization";
import { cn } from "@/lib/utils";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

export function SkillTrack_SkillMatrixReport() {
    const [team] = useQueryState("team");

    if (team === null) {
        return (
            <SkillTrack_ReportTeamScopePicker routePattern="/orgs/[slug]/skill-track/reports/matrix" />
        );
    }

    return <SkillMatrixReportView teamParam={team} />;
}

function SkillMatrixReportView({ teamParam }: { teamParam: string }) {
    const organization = useOrganization();

    const parsedTeamId = TeamId.schema.safeParse(teamParam);
    const teamId = parsedTeamId.success ? parsedTeamId.data : undefined;

    const {
        data: { personnel, skillPackages, skillGroups, skills, competencies: recordedCompetencies },
    } = useSuspenseQuery(
        trpc.skillChecks.getCompetencyMatrix.queryOptions({
            organizationId: organization.id,
            teamId,
        }),
    );

    const { competencies, syntheticActions } = useSyntheticCompetencies(
        skills,
        personnel,
        recordedCompetencies,
    );

    const competencyByKey = new Map(
        competencies.map((competency) => [
            `${competency.assesseeId}:${competency.skillId}`,
            competency,
        ]),
    );

    const people = R.sortBy(personnel, (person) => person.name);

    // Skills flattened in package -> group -> skill order, with a marker row before each group.
    const skillRows = R.pipe(
        skillPackages,
        R.sortBy((skillPackage) => skillPackage.name),
        R.flatMap((skillPackage) =>
            R.pipe(
                skillGroups,
                R.filter((skillGroup) => skillGroup.skillPackageId === skillPackage.id),
                R.sortBy((skillGroup) => skillGroup.sequence),
                R.flatMap((skillGroup) => {
                    const groupSkills = R.pipe(
                        skills,
                        R.filter((skill) => skill.skillGroupId === skillGroup.id),
                        R.sortBy((skill) => skill.sequence),
                    );
                    if (groupSkills.length === 0) return [];
                    return [
                        {
                            kind: "group" as const,
                            id: skillGroup.id,
                            label: `${skillPackage.name} · ${skillGroup.name}`,
                        },
                        ...groupSkills.map((skill) => ({ kind: "skill" as const, skill })),
                    ];
                }),
            ),
        ),
    );

    const stickyFirstCol = "sticky left-0 z-10 bg-background";

    const PERSON_HEADER_HEIGHT = 130;
    const SKILL_COL_WIDTH = 220;
    const PERSON_COL_WIDTH = 50;

    const isEmpty = people.length === 0 || skills.length === 0;

    return (
        <>
            <ReportNavbar routePattern="/orgs/[slug]/skill-track/reports/matrix" />
            <main className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                        <h1 className="text-lg font-semibold">Personnel × Skill Matrix</h1>
                        <p className="text-sm text-muted-foreground">
                            {people.length} {people.length === 1 ? "person" : "people"} ·{" "}
                            {skills.length} {skills.length === 1 ? "skill" : "skills"} ·{" "}
                            {teamId ? "Team" : "Whole Organization"}
                        </p>
                    </div>
                    {syntheticActions}
                </div>

                {isEmpty ? (
                    <Empty>
                        <EmptyDescription>
                            {people.length === 0
                                ? "There are no active personnel in this scope."
                                : "This organization is not subscribed to any skill packages."}
                        </EmptyDescription>
                    </Empty>
                ) : (
                    <div className="min-h-0 min-w-0 flex-1 overflow-auto rounded-md border">
                        <table className="table-fixed border-separate border-spacing-0 text-sm">
                            <colgroup>
                                <col style={{ width: SKILL_COL_WIDTH }} />
                                {people.map((person) => (
                                    <col key={person.id} style={{ width: PERSON_COL_WIDTH }} />
                                ))}
                            </colgroup>
                            <thead>
                                <tr>
                                    <th className={cn(stickyFirstCol, "top-0 z-30 p-0")}>
                                        <DiagonalLeadColumnHeader
                                            label="Skill"
                                            headerHeight={PERSON_HEADER_HEIGHT}
                                            columnWidth={SKILL_COL_WIDTH}
                                        />
                                    </th>
                                    {people.map((person) => (
                                        <th
                                            key={person.id}
                                            className="sticky top-0 z-20 p-0 font-medium border-b"
                                        >
                                            <DiagonalColumnHeader
                                                label={person.name}
                                                headerHeight={PERSON_HEADER_HEIGHT}
                                                columnWidth={PERSON_COL_WIDTH}
                                            />
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {skillRows.map((row) =>
                                    row.kind === "group" ? (
                                        <tr key={`group-${row.id}`}>
                                            <th
                                                colSpan={people.length + 1}
                                                className="bg-muted border-b p-0 text-left"
                                            >
                                                <div className="sticky left-0 z-10 w-fit bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                    {row.label}
                                                </div>
                                            </th>
                                        </tr>
                                    ) : (
                                        <tr key={row.skill.id} className="hover:bg-muted/40">
                                            <th
                                                scope="row"
                                                className={cn(
                                                    stickyFirstCol,
                                                    "border-r border-b p-0 font-normal",
                                                )}
                                                title={row.skill.name}
                                            >
                                                <div
                                                    className="truncate px-3 py-1.5 text-left"
                                                    style={{ width: SKILL_COL_WIDTH }}
                                                >
                                                    {row.skill.name}
                                                </div>
                                            </th>
                                            {people.map((person, i) => {
                                                const status = deriveStatus(
                                                    competencyByKey.get(
                                                        `${person.id}:${row.skill.id}`,
                                                    ),
                                                );
                                                return (
                                                    <td
                                                        key={person.id}
                                                        className={cn(
                                                            "border-b px-2 py-1.5 text-center",
                                                            i > 0 && "border-l",
                                                            i === people.length - 1 && "border-r",
                                                        )}
                                                    >
                                                        <StatusIcon
                                                            status={status}
                                                            className="mx-auto"
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ),
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </>
    );
}
