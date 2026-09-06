/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";
import * as R from "remeda";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";

import { UserXIcon } from "lucide-react";

import { Glorious } from "@/components/blocks/glorious";
import { DropdownMenuTriggerIcon } from "@/components/icons";
import { SkillTrack_PersonScopeDialog } from "@/components/skill-track/reports/person-scope-dialog";
import {
    deriveStatus,
    StatusBadge,
    type CompetencyStatus,
} from "@/components/skill-track/reports/competency-status";
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
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { useSyntheticCompetencies } from "@/components/skill-track/reports/synthetic-competency-data";

import { useOrganization } from "@/hooks/use-organization";
import { formatDate } from "@/lib/datetime";
import { PersonId } from "@/lib/schemas/person";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

export function SkillTrack_PersonCompetencyReport() {
    const [personParam] = useQueryState("person");
    const parsedPersonId = personParam ? PersonId.schema.safeParse(personParam) : undefined;

    // An absent — or malformed — `?person=` means "nothing picked yet"; show the blank
    // report shell with the scope dialog forced open.
    if (!parsedPersonId?.success) {
        return (
            <Glorious.Root className="mx-auto w-full max-w-4xl">
                <Glorious.Header>
                    <Glorious.Title>Personal Competency Report</Glorious.Title>
                    <Glorious.Actions>
                        <SkillTrack_PersonScopeDialog forceOpen label="Select a person" />
                    </Glorious.Actions>
                </Glorious.Header>
                <Empty>
                    <EmptyDescription>
                        Select a person to view their competency report.
                    </EmptyDescription>
                </Empty>
            </Glorious.Root>
        );
    }

    return <PersonCompetencyReportView personId={parsedPersonId.data} />;
}

const HEADER_HEIGHT = 36;

const stickyFirstCol = "sticky left-0 z-10 bg-background";
const headCell =
    "h-9 border-b bg-background px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide";

function PersonCompetencyReportView({ personId }: { personId: PersonId }) {
    const organization = useOrganization();

    const {
        data: { personnel, skillPackages, skillGroups, skills, competencies: recordedCompetencies },
    } = useSuspenseQuery(
        trpc.skillChecks.getCompetencyMatrix.queryOptions({
            organizationId: organization.id,
            personId,
        }),
    );

    const { competencies, syntheticActions, syntheticMenuItem } = useSyntheticCompetencies(
        skills,
        personnel,
        recordedCompetencies,
    );

    const [gapsOnly, setGapsOnly] = useState(false);
    const [showSkillDescription, setShowSkillDescription] = useState(false);
    const [showStatusCounts, setShowStatusCounts] = useState(true);

    const person = personnel[0];

    // Pair each in-scope skill with its most recent approved check (if any).
    const competencyBySkillId = new Map(competencies.map((c) => [c.skillId, c]));

    const rows = skills.map((skill) => {
        const competency = competencyBySkillId.get(skill.id);
        const status: CompetencyStatus = deriveStatus(competency);
        return { skill, competency, status };
    });

    const counts = {
        current: rows.filter((row) => row.status === "current").length,
        expired: rows.filter((row) => row.status === "expired").length,
        notCompetent: rows.filter((row) => row.status === "not-competent").length,
        notAssessed: rows.filter((row) => row.status === "not-assessed").length,
    };

    const visibleRows = gapsOnly ? rows.filter((row) => row.status !== "current") : rows;

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

    if (!person) {
        return (
            <Glorious.Root className="mx-auto w-full max-w-4xl">
                <Glorious.Header>
                    <Glorious.Title>Personnel Competency</Glorious.Title>
                    <Glorious.Actions>
                        <SkillTrack_PersonScopeDialog label="Select a person" />
                    </Glorious.Actions>
                </Glorious.Header>
                <Empty>
                    <EmptyMedia>
                        <UserXIcon className="size-12 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyDescription>
                        This person is not an active member of the organization.
                    </EmptyDescription>
                </Empty>
            </Glorious.Root>
        );
    }

    return (
        <Glorious.Root>
            <Glorious.Header>
                <Glorious.Title>Personal Competency Report</Glorious.Title>
                <Glorious.Subtitle>
                    <div>
                        {person.name}
                        {" · "}
                        {rows.length} {rows.length === 1 ? "skill" : "skills"}
                    </div>

                    {showStatusCounts && (
                        <div>
                            {counts.current} current · {counts.expired} expired ·{" "}
                            {counts.notCompetent} not competent · {counts.notAssessed} not assessed
                        </div>
                    )}
                </Glorious.Subtitle>
                <Glorious.Actions>
                    <SkillTrack_PersonScopeDialog />
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
                                <DropdownMenuCheckboxItem
                                    checked={showSkillDescription}
                                    onCheckedChange={setShowSkillDescription}
                                >
                                    <span>Skill Description</span>
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                    checked={showStatusCounts}
                                    onCheckedChange={setShowStatusCounts}
                                >
                                    <span>Status Counts</span>
                                </DropdownMenuCheckboxItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>{syntheticMenuItem}</DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </Glorious.Actions>
            </Glorious.Header>

            {groupSections.length === 0 ? (
                <Empty>
                    <EmptyDescription>
                        {gapsOnly
                            ? "Every assessable skill is current for this person."
                            : "This organization is not subscribed to any skill packages."}
                    </EmptyDescription>
                </Empty>
            ) : (
                <Glorious.ScrollFrame>
                    <Glorious.Table className="w-full">
                        <colgroup>
                            <col className="w-[60%] sm:w-[55%]" />
                            <col className="w-[40%] sm:w-[25%]" />
                            <col className="hidden sm:table-column sm:w-[20%]" />
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
                        {groupSections.map((section) => (
                            <Glorious.GroupSection
                                key={section.id}
                                label={section.label}
                                headerOffset={HEADER_HEIGHT}
                                colSpan={3}
                            >
                                {section.rows.map(({ skill, competency, status }) => (
                                    <tr key={skill.id} className="hover:bg-muted/40">
                                        <th
                                            scope="row"
                                            className={cn(
                                                stickyFirstCol,
                                                "border-r border-b px-3 py-1.5 text-left align-top font-normal",
                                            )}
                                            title={skill.name}
                                        >
                                            <div className="truncate">{skill.name}</div>
                                            {showSkillDescription && skill.description && (
                                                <div className="truncate text-xs text-muted-foreground">
                                                    {skill.description}
                                                </div>
                                            )}
                                        </th>
                                        <td className="border-b px-3 py-1.5 text-center align-top sm:border-r">
                                            <StatusBadge status={status} />
                                        </td>
                                        <td className="hidden border-b px-3 py-1.5 text-center align-top text-sm text-muted-foreground tabular-nums sm:table-cell">
                                            {competency ? formatDate(competency.checkedAt) : "—"}
                                        </td>
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
