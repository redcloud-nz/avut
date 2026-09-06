/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import * as R from "remeda";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";

import { Glorious } from "@/components/blocks/glorious";
import { SkillTrack_TeamScopeDialog } from "@/components/skill-track/reports/team-scope-dialog";
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

    // An absent — or malformed — `?team=` means "nothing picked yet"; show the blank report
    // shell with the scope dialog forced open.
    if (team === null || (team !== "all" && !TeamId.schema.safeParse(team).success)) {
        return (
            <Glorious.Root className="mx-auto w-full max-w-4xl">
                <Glorious.Header>
                    <Glorious.Title>Personnel × Skill Matrix</Glorious.Title>
                    <Glorious.Actions>
                        <SkillTrack_TeamScopeDialog forceOpen label="Select a scope" />
                    </Glorious.Actions>
                </Glorious.Header>
                <Empty>
                    <EmptyDescription>
                        Select a team, or the whole organization, to view the matrix.
                    </EmptyDescription>
                </Empty>
            </Glorious.Root>
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

    // One section per skill group, in package -> group -> skill order. Each renders as its own
    // <tbody> so the group's sticky header releases at the section boundary when scrolling.
    const groupSections = R.pipe(
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
                            id: skillGroup.id,
                            label: `${skillPackage.name} · ${skillGroup.name}`,
                            skills: groupSkills,
                        },
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
        <Glorious.Root>
            <Glorious.Header>
                <div>
                    <Glorious.Title>Personnel × Skill Matrix</Glorious.Title>
                    <Glorious.Subtitle>
                        {people.length} {people.length === 1 ? "person" : "people"} ·{" "}
                        {skills.length} {skills.length === 1 ? "skill" : "skills"} ·{" "}
                        {teamId ? "Team" : "Whole Organization"}
                    </Glorious.Subtitle>
                </div>
                <Glorious.Actions>
                    <SkillTrack_TeamScopeDialog />
                    {syntheticActions}
                </Glorious.Actions>
            </Glorious.Header>

            {isEmpty ? (
                <Empty>
                    <EmptyDescription>
                        {people.length === 0
                            ? "There are no active personnel in this scope."
                            : "This organization is not subscribed to any skill packages."}
                    </EmptyDescription>
                </Empty>
            ) : (
                <Glorious.ScrollFrame>
                    <Glorious.Table>
                        <colgroup>
                            <col style={{ width: SKILL_COL_WIDTH }} />
                            {people.map((person) => (
                                <col key={person.id} style={{ width: PERSON_COL_WIDTH }} />
                            ))}
                        </colgroup>
                        <Glorious.TableHeader>
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
                        </Glorious.TableHeader>
                        {groupSections.map((section) => (
                            <Glorious.GroupSection
                                key={section.id}
                                label={section.label}
                                headerOffset={PERSON_HEADER_HEIGHT}
                                colSpan={people.length + 1}
                            >
                                {section.skills.map((skill) => (
                                    <tr key={skill.id} className="hover:bg-muted/40">
                                        <th
                                            scope="row"
                                            className={cn(
                                                stickyFirstCol,
                                                "border-r border-b p-0 font-normal",
                                            )}
                                            title={skill.name}
                                        >
                                            <div
                                                className="truncate px-3 py-1.5 text-left"
                                                style={{ width: SKILL_COL_WIDTH }}
                                            >
                                                {skill.name}
                                            </div>
                                        </th>
                                        {people.map((person, i) => {
                                            const status = deriveStatus(
                                                competencyByKey.get(`${person.id}:${skill.id}`),
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
                                ))}
                            </Glorious.GroupSection>
                        ))}
                    </Glorious.Table>
                </Glorious.ScrollFrame>
            )}
        </Glorious.Root>
    );
}
