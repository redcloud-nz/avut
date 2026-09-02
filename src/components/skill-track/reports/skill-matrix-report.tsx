/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import * as R from "remeda";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import {
    ReportNavbar,
    SkillTrack_ReportTeamScopePicker,
} from "@/components/skill-track/reports/report-scope-picker";
import { deriveStatus, StatusIcon } from "@/components/skill-track/reports/competency-status";
import { useSyntheticCompetencies } from "@/components/skill-track/reports/synthetic-competency-data";
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

    const stickyFirstCol = "sticky left-0 z-10 bg-background border-r min-w-48 max-w-64 truncate";

    return (
        <>
            <ReportNavbar routePattern="/orgs/[slug]/skill-track/reports/matrix" />
            <Std.ScrollContainer>
                <Saratoga.Root className="max-w-none">
                    <Saratoga.Header>
                        <Saratoga.Title>Personnel × Skill Matrix</Saratoga.Title>
                        {syntheticActions && (
                            <Saratoga.Actions>{syntheticActions}</Saratoga.Actions>
                        )}
                    </Saratoga.Header>

                    <p className="mt-2 text-sm text-muted-foreground">
                        {people.length} {people.length === 1 ? "person" : "people"} ·{" "}
                        {skills.length} {skills.length === 1 ? "skill" : "skills"} ·{" "}
                        {teamId ? "Team" : "Whole Organization"}
                    </p>

                    {people.length === 0 || skills.length === 0 ? (
                        <Empty>
                            <EmptyDescription>
                                {people.length === 0
                                    ? "There are no active personnel in this scope."
                                    : "This organization is not subscribed to any skill packages."}
                            </EmptyDescription>
                        </Empty>
                    ) : (
                        <div className="mt-6 max-h-[70vh] overflow-auto rounded-md border">
                            <table className="border-separate border-spacing-0 text-sm">
                                <thead>
                                    <tr>
                                        <th
                                            className={cn(
                                                stickyFirstCol,
                                                "top-0 z-30 border-b text-left px-3 py-2 font-medium",
                                            )}
                                        >
                                            Skill
                                        </th>
                                        {people.map((person) => (
                                            <th
                                                key={person.id}
                                                className="sticky top-0 z-20 bg-background border-b border-l px-2 py-2 font-medium"
                                                title={person.name}
                                            >
                                                <div className="w-8 mx-auto truncate text-center">
                                                    {person.name}
                                                </div>
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
                                                    <div className="sticky left-0 w-fit px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
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
                                                        "border-b text-left px-3 py-1.5 font-normal",
                                                    )}
                                                    title={row.skill.name}
                                                >
                                                    {row.skill.name}
                                                </th>
                                                {people.map((person) => {
                                                    const status = deriveStatus(
                                                        competencyByKey.get(
                                                            `${person.id}:${row.skill.id}`,
                                                        ),
                                                    );
                                                    return (
                                                        <td
                                                            key={person.id}
                                                            className="border-b border-l px-2 py-1.5 text-center"
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
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
