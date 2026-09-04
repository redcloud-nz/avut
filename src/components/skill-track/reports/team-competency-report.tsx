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

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";
import { useSyntheticCompetencies } from "@/components/skill-track/reports/synthetic-competency-data";

import { useOrganization } from "@/hooks/use-organization";
import { TeamId } from "@/lib/schemas/team";
import { trpc } from "@/trpc/client";

const STATUS_ORDER = ["current", "expired", "not-competent", "not-assessed"] as const;

export function SkillTrack_TeamCompetencyReport() {
    const [team] = useQueryState("team");

    if (team === null) {
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

    const packageSections = R.pipe(
        skillPackages,
        R.sortBy((skillPackage) => skillPackage.name),
        R.map((skillPackage) => ({
            skillPackage,
            groups: R.pipe(
                skillGroups,
                R.filter((skillGroup) => skillGroup.skillPackageId === skillPackage.id),
                R.sortBy((skillGroup) => skillGroup.sequence),
                R.map((skillGroup) => ({
                    skillGroup,
                    rows: R.pipe(
                        visibleRows,
                        R.filter((row) => row.skill.skillGroupId === skillGroup.id),
                        R.sortBy((row) => row.skill.sequence),
                    ),
                })),
                R.filter(({ rows }) => rows.length > 0),
            ),
        })),
        R.filter(({ groups }) => groups.length > 0),
    );

    const scopeLabel = teamId ? "Team" : "Whole Organization";

    return (
        <>
            <ReportNavbar routePattern="/orgs/[slug]/skill-track/reports/team" />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>
                            {teamId ? "Team Competency" : "Whole Organization"}
                        </Saratoga.Title>
                        <Saratoga.Actions>
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
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    <p className="mt-2 text-sm text-muted-foreground">
                        {total} {total === 1 ? "person" : "people"} in scope · {scopeLabel}
                    </p>

                    {total === 0 ? (
                        <Empty>
                            <EmptyDescription>
                                There are no active personnel in this scope.
                            </EmptyDescription>
                        </Empty>
                    ) : packageSections.length === 0 ? (
                        <Empty>
                            <EmptyDescription>
                                {gapsOnly
                                    ? "Every assessable skill is current for everyone in scope."
                                    : "This organization is not subscribed to any skill packages."}
                            </EmptyDescription>
                        </Empty>
                    ) : (
                        <div className="mt-6 space-y-6">
                            {packageSections.map(({ skillPackage, groups }) => (
                                <Collapsible key={skillPackage.id} defaultOpen>
                                    <CollapsibleTrigger className="group w-full flex items-center justify-between gap-2 font-semibold border-b pb-1 hover:text-accent-foreground">
                                        <span>{skillPackage.name}</span>
                                        <ChevronDownIcon className="size-4 group-data-[state=open]:rotate-180" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <div className="space-y-6 pt-4">
                                            {groups.map(({ skillGroup, rows }) => (
                                                <div key={skillGroup.id}>
                                                    <div className="text-sm font-medium text-muted-foreground mb-2">
                                                        {skillGroup.name}
                                                    </div>
                                                    {rows.map(({ skill, counts, currentPct }) => (
                                                        <Item key={skill.id}>
                                                            <ItemContent>
                                                                <ItemTitle>{skill.name}</ItemTitle>
                                                                <CompetencyBar
                                                                    counts={counts}
                                                                    total={total}
                                                                />
                                                            </ItemContent>
                                                            <div className="shrink-0 text-right text-sm tabular-nums">
                                                                <div className="font-medium">
                                                                    {currentPct}%
                                                                </div>
                                                                <div className="text-muted-foreground">
                                                                    {counts.current}/{total} current
                                                                </div>
                                                            </div>
                                                        </Item>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </CollapsibleContent>
                                </Collapsible>
                            ))}
                        </div>
                    )}
                </Saratoga.Root>
            </Std.ScrollContainer>
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
            className="mt-1 flex h-2 w-full max-w-md overflow-hidden rounded-full"
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
