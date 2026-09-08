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
    CheckDetailsTrigger,
    ReportCellPopoversProvider,
} from "@/components/skill-track/reports/report-cell-popovers";
import { SkillTrack_ScopeDialogMenuItem } from "@/components/skill-track/reports/scope-dialog-menu-item";
import { SkillTrack_SkillScopeDialog } from "@/components/skill-track/reports/skill-scope-dialog";
import {
    deriveStatus,
    STATUS_RANK,
    StatusBadge,
    tallyStatuses,
} from "@/components/skill-track/reports/competency-status";
import { useSyntheticCompetencies } from "@/components/skill-track/reports/synthetic-competency-data";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

    // An absent — or malformed — `?skill=` means "nothing picked yet"; show the blank report
    // shell with the scope dialog forced open.
    if (!parsedSkillId?.success) {
        return (
            <Glorious.Root className="mx-auto w-full max-w-4xl">
                <Glorious.Header>
                    <Glorious.Title>Skill Coverage Report</Glorious.Title>
                    <Glorious.Actions>
                        <SkillTrack_SkillScopeDialog forceOpen label="Select a skill" />
                    </Glorious.Actions>
                </Glorious.Header>
                <Empty>
                    <EmptyDescription>
                        Select a skill to see who currently holds it.
                    </EmptyDescription>
                </Empty>
            </Glorious.Root>
        );
    }

    return <SkillCoverageReportView skillId={parsedSkillId.data} />;
}

function SkillCoverageReportView({ skillId }: { skillId: SkillId }) {
    const organization = useOrganization();

    const [teamParam] = useQueryState("team");

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

    const {
        competencies,
        isSynthetic,
        syntheticActions,
        syntheticMenuItem,
        syntheticOpenMenuItem,
    } = useSyntheticCompetencies(skills, personnel, recordedCompetencies);

    const [showStatusCounts, setShowStatusCounts] = useState(true);

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
                competency,
                status: deriveStatus(competency),
                checkedAt: competency?.checkedAt ?? null,
            };
        }),
        // Default "worst first" so coverage gaps surface at the top, name as the tiebreaker.
        R.sortBy([(row) => STATUS_RANK[row.status], "desc"], [(row) => row.name, "asc"]),
    );

    const counts = tallyStatuses(rows.map((row) => row.status));

    const scopeLabel = teamId
        ? (teams.find((team) => team.id === teamId)?.name ?? "Team")
        : "Whole Organization";

    return (
        <ReportCellPopoversProvider isSynthetic={isSynthetic}>
            <Glorious.Root>
                <Glorious.Header>
                    <Glorious.Title>Skill Coverage Report</Glorious.Title>
                    <Glorious.Subtitle>
                        <div>
                            {skill ? skill.name : "Unknown Skill"}
                            <span className="hidden sm:inline">{" · "}</span>
                            <br className="inline sm:hidden" />
                            {scopeLabel} ({rows.length} {rows.length === 1 ? "person" : "people"})
                        </div>
                        {showStatusCounts && (
                            <div>
                                {counts.current} current · {counts.expired} expired ·{" "}
                                {counts["not-competent"]} not competent · {counts["not-assessed"]}{" "}
                                not assessed
                            </div>
                        )}
                    </Glorious.Subtitle>
                    <Glorious.Actions>
                        <SkillTrack_SkillScopeDialog compact />
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
                                        checked={showStatusCounts}
                                        onCheckedChange={setShowStatusCounts}
                                    >
                                        <span>Status Counts</span>
                                    </DropdownMenuCheckboxItem>
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator className="sm:hidden" />
                                <SkillTrack_ScopeDialogMenuItem />
                                {syntheticOpenMenuItem}
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>{syntheticMenuItem}</DropdownMenuGroup>
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
                                            {row.competency ? (
                                                <CheckDetailsTrigger
                                                    competency={row.competency}
                                                    className="cursor-pointer hover:opacity-80"
                                                >
                                                    <StatusBadge status={row.status} />
                                                </CheckDetailsTrigger>
                                            ) : (
                                                <StatusBadge status={row.status} />
                                            )}
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
        </ReportCellPopoversProvider>
    );
}
