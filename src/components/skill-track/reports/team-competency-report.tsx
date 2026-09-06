/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";
import * as R from "remeda";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";

import { Glorious } from "@/components/blocks/glorious";
import { DropdownMenuTriggerIcon } from "@/components/icons";
import {
    ReportNavbar,
    SkillTrack_ReportTeamScopePicker,
} from "@/components/skill-track/reports/report-scope-picker";
import {
    deriveStatus,
    STATUS_BAR_COLORS,
    STATUS_LABELS,
    tallyStatuses,
    type CompetencyStatus,
} from "@/components/skill-track/reports/competency-status";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { useSyntheticCompetencies } from "@/components/skill-track/reports/synthetic-competency-data";

import { useOrganization } from "@/hooks/use-organization";
import { cn } from "@/lib/utils";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

const STATUS_ORDER = ["current", "expired", "not-competent", "not-assessed"] as const;

const HEADER_HEIGHT = 36;
const SKILL_COL_WIDTH = "45%";
const BAR_COL_WIDTH = "35%";
const PCT_COL_WIDTH = "20%";

const stickyFirstCol = "sticky left-0 z-10 bg-background";
const headCell =
    "h-9 border-b bg-background px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide";

export function SkillTrack_TeamCompetencyReport() {
    const [team] = useQueryState("team");

    // An absent — or malformed — `?team=` means "nothing picked yet"; show the picker rather
    // than falling through to a full-org competency matrix.
    if (team === null || (team !== "all" && !TeamId.schema.safeParse(team).success)) {
        return (
            <SkillTrack_ReportTeamScopePicker routePattern="/orgs/[slug]/skill-track/reports/team" />
        );
    }

    return <TeamCompetencyReportView teamParam={team} />;
}

function TeamCompetencyReportView({ teamParam }: { teamParam: string }) {
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

    const [gapsOnly, setGapsOnly] = useState(false);

    // (assesseeId, skillId) -> competency, so each person/skill pair resolves in O(1).
    const competencyByKey = new Map(
        competencies.map((competency) => [
            `${competency.assesseeId}:${competency.skillId}`,
            competency,
        ]),
    );

    const total = personnel.length;

    // Per-skill status breakdown across every in-scope person. Not-assessed people count
    // toward the denominator, so an unchecked skill reads as "not assessed", not 100% current.
    const rows = skills.map((skill) => {
        const counts = tallyStatuses(
            personnel.map((person) =>
                deriveStatus(competencyByKey.get(`${person.id}:${skill.id}`)),
            ),
        );
        const currentPct = total === 0 ? 0 : Math.round((counts.current / total) * 100);
        return { skill, counts, currentPct };
    });

    const visibleRows = gapsOnly ? rows.filter((row) => row.counts.current < total) : rows;

    // One section per skill group, in package -> group -> skill order, flattened to a single
    // "Package · Group" level (matches the skill-matrix report). Empty groups are dropped.
    const groupSections = R.pipe(
        skillPackages,
        R.sortBy((skillPackage) => skillPackage.name),
        R.flatMap((skillPackage) =>
            R.pipe(
                skillGroups,
                R.filter((skillGroup) => skillGroup.skillPackageId === skillPackage.id),
                R.sortBy((skillGroup) => skillGroup.sequence),
                R.flatMap((skillGroup) => {
                    const groupRows = R.pipe(
                        visibleRows,
                        R.filter((row) => row.skill.skillGroupId === skillGroup.id),
                        R.sortBy((row) => row.skill.sequence),
                    );
                    if (groupRows.length === 0) return [];
                    return [
                        {
                            id: skillGroup.id,
                            label: `${skillPackage.name} · ${skillGroup.name}`,
                            rows: groupRows,
                        },
                    ];
                }),
            ),
        ),
    );

    const scopeLabel = teamId ? "Team" : "Whole Organization";

    return (
        <>
            <ReportNavbar routePattern="/orgs/[slug]/skill-track/reports/team" />
            <Glorious.Root>
                <Glorious.Header>
                    <div>
                        <Glorious.Title>
                            {teamId ? "Team Competency" : "Whole Organization"}
                        </Glorious.Title>
                        <Glorious.Subtitle>
                            {total} {total === 1 ? "person" : "people"} in scope · {scopeLabel}
                        </Glorious.Subtitle>
                    </div>
                    <Glorious.Actions>
                        {syntheticActions}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost">
                                    <DropdownMenuTriggerIcon />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end">
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>Show</DropdownMenuLabel>
                                    <DropdownMenuCheckboxItem
                                        checked={gapsOnly}
                                        onCheckedChange={setGapsOnly}
                                    >
                                        <span>Only Gaps</span>
                                    </DropdownMenuCheckboxItem>
                                </DropdownMenuGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </Glorious.Actions>
                </Glorious.Header>

                {total === 0 ? (
                    <Empty>
                        <EmptyDescription>
                            There are no active personnel in this scope.
                        </EmptyDescription>
                    </Empty>
                ) : groupSections.length === 0 ? (
                    <Empty>
                        <EmptyDescription>
                            {gapsOnly
                                ? "Every assessable skill is current for everyone in scope."
                                : "This organization is not subscribed to any skill packages."}
                        </EmptyDescription>
                    </Empty>
                ) : (
                    <Glorious.ScrollFrame>
                        <Glorious.Table className="w-full">
                            <colgroup>
                                <col style={{ width: SKILL_COL_WIDTH }} />
                                <col style={{ width: BAR_COL_WIDTH }} />
                                <col style={{ width: PCT_COL_WIDTH }} />
                            </colgroup>
                            <Glorious.TableHeader>
                                <th
                                    className={cn(
                                        stickyFirstCol,
                                        headCell,
                                        "top-0 z-30 border-r text-left",
                                    )}
                                >
                                    Skill
                                </th>
                                <th
                                    className={cn(headCell, "sticky top-0 z-20 border-r text-left")}
                                >
                                    Coverage
                                </th>
                                <th className={cn(headCell, "sticky top-0 z-20 text-center")}>
                                    Current
                                </th>
                            </Glorious.TableHeader>
                            {groupSections.map((section) => (
                                <Glorious.GroupSection
                                    key={section.id}
                                    label={section.label}
                                    headerOffset={HEADER_HEIGHT}
                                    colSpan={3}
                                >
                                    {section.rows.map(({ skill, counts, currentPct }) => (
                                        <tr key={skill.id} className="hover:bg-muted/40">
                                            <th
                                                scope="row"
                                                className={cn(
                                                    stickyFirstCol,
                                                    "truncate border-r border-b px-3 py-1.5 text-left align-middle font-normal",
                                                )}
                                                title={skill.name}
                                            >
                                                {skill.name}
                                            </th>
                                            <td className="border-r border-b px-3 py-1.5 align-middle">
                                                <CompetencyBar counts={counts} total={total} />
                                            </td>
                                            <td className="border-b px-3 py-1.5 text-center align-middle text-sm tabular-nums">
                                                <span className="font-medium">{currentPct}%</span>{" "}
                                                <span className="text-muted-foreground">
                                                    ({counts.current}/{total})
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </Glorious.GroupSection>
                            ))}
                        </Glorious.Table>
                    </Glorious.ScrollFrame>
                )}
            </Glorious.Root>
        </>
    );
}

function CompetencyBar({
    counts,
    total,
}: {
    counts: Record<CompetencyStatus, number>;
    total: number;
}) {
    return (
        <div
            className="flex h-2 w-full overflow-hidden rounded-full"
            role="img"
            aria-label={STATUS_ORDER.map(
                (status) => `${counts[status]} ${STATUS_LABELS[status]}`,
            ).join(", ")}
        >
            {STATUS_ORDER.map((status) =>
                counts[status] === 0 ? null : (
                    <div
                        key={status}
                        className={STATUS_BAR_COLORS[status]}
                        style={{ width: `${(counts[status] / total) * 100}%` }}
                    />
                ),
            )}
        </div>
    );
}
