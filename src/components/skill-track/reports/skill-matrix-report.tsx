/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";
import * as R from "remeda";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";

import { ChevronDownIcon } from "lucide-react";

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

    // An absent — or malformed — `?team=` means "nothing picked yet"; show the picker rather
    // than falling through to a full-org competency matrix.
    if (team === null || (team !== "all" && !TeamId.schema.safeParse(team).success)) {
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

    const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set());

    const toggleGroup = (groupId: string) =>
        setCollapsedGroups((previous) => {
            const next = new Set(previous);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });

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
                            {groupSections.map((section) => {
                                const collapsed = collapsedGroups.has(section.id);
                                return (
                                    <tbody key={section.id}>
                                        <tr>
                                            <th
                                                colSpan={people.length + 1}
                                                style={{ top: PERSON_HEADER_HEIGHT }}
                                                className="sticky z-20 bg-muted p-0 text-left"
                                            >
                                                {/* Full-width wrapper carries the divider — a
                                                    border on the sticky <th> itself paints
                                                    unreliably once it's stuck. The button stays
                                                    narrow so it has room to stick horizontally. */}
                                                <div className="border-b">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleGroup(section.id)}
                                                        aria-expanded={!collapsed}
                                                        className="sticky left-0 z-10 flex w-fit items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground"
                                                    >
                                                        <ChevronDownIcon
                                                            className={cn(
                                                                "size-3.5 transition-transform",
                                                                collapsed && "-rotate-90",
                                                            )}
                                                        />
                                                        {section.label}
                                                    </button>
                                                </div>
                                            </th>
                                        </tr>
                                        {!collapsed &&
                                            section.skills.map((skill) => (
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
                                                            competencyByKey.get(
                                                                `${person.id}:${skill.id}`,
                                                            ),
                                                        );
                                                        return (
                                                            <td
                                                                key={person.id}
                                                                className={cn(
                                                                    "border-b px-2 py-1.5 text-center",
                                                                    i > 0 && "border-l",
                                                                    i === people.length - 1 &&
                                                                        "border-r",
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
                                    </tbody>
                                );
                            })}
                        </table>
                    </div>
                )}
            </main>
        </>
    );
}
