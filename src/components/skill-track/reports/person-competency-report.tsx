/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";
import * as R from "remeda";
import { match } from "ts-pattern";

import { useSuspenseQuery } from "@tanstack/react-query";

import { ChevronDownIcon, UserXIcon } from "lucide-react";

import { Saratoga } from "@/components/blocks/saratoga";
import { DropdownMenuTriggerIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
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
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemTitle } from "@/components/ui/item";

import { useOrganization } from "@/hooks/use-organization";
import { formatDate } from "@/lib/datetime";
import { PersonId } from "@/lib/schemas/person";
import { isCompetentResult } from "@/lib/schemas/skill-check";
import {
    DEFAULT_SYNTHETIC_CONFIG,
    generateSyntheticCompetencies,
    SyntheticDataDialog,
} from "@/components/skill-track/reports/synthetic-competency-data";
import { trpc } from "@/trpc/client";

type CompetencyStatus = "current" | "expired" | "not-competent" | "not-assessed";

export function SkillTrack_PersonCompetencyReport({
    personId,
    synthetic = false,
}: {
    personId: PersonId;
    synthetic?: boolean;
}) {
    const organization = useOrganization();

    const {
        data: { personnel, skillPackages, skillGroups, skills, competencies },
    } = useSuspenseQuery(
        trpc.skillChecks.getCompetencyMatrix.queryOptions({
            organizationId: organization.id,
            personId,
        }),
    );

    const [gapsOnly, setGapsOnly] = useState(false);
    const [syntheticConfig, setSyntheticConfig] = useState(DEFAULT_SYNTHETIC_CONFIG);

    const person = personnel[0];

    // Pair each in-scope skill with its most recent approved check (if any).
    const competencyBySkillId = new Map(
        (synthetic
            ? generateSyntheticCompetencies(skills, personId, syntheticConfig)
            : competencies
        ).map((c) => [c.skillId, c]),
    );

    // A check only counts towards competency if its result demonstrates competency — a
    // "Not Yet Competent" result is a fail regardless of how recently it was recorded, so
    // expiry is only meaningful for a competent result.
    const rows = skills.map((skill) => {
        const competency = competencyBySkillId.get(skill.id);
        const status: CompetencyStatus = !competency
            ? "not-assessed"
            : !isCompetentResult(competency.result)
              ? "not-competent"
              : competency.isCurrent
                ? "current"
                : "expired";
        return { skill, competency, status };
    });

    const counts = {
        current: rows.filter((row) => row.status === "current").length,
        expired: rows.filter((row) => row.status === "expired").length,
        notCompetent: rows.filter((row) => row.status === "not-competent").length,
        notAssessed: rows.filter((row) => row.status === "not-assessed").length,
    };

    const visibleRows = gapsOnly ? rows.filter((row) => row.status !== "current") : rows;

    // Package -> group -> skills. Packages are ordered by name, groups and skills by their
    // authored sequence. Groups and packages left empty by the filter are dropped.
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

    if (!person) {
        return (
            <Saratoga.Root>
                <Empty>
                    <EmptyMedia>
                        <UserXIcon className="size-12 text-muted-foreground" />
                    </EmptyMedia>
                    <EmptyDescription>
                        This person is not an active member of the organization.
                    </EmptyDescription>
                </Empty>
            </Saratoga.Root>
        );
    }

    return (
        <Saratoga.Root>
            <Saratoga.Header>
                <Saratoga.Title>{person.name}</Saratoga.Title>
                <Saratoga.Actions>
                    {synthetic && (
                        <SyntheticDataDialog
                            config={syntheticConfig}
                            onConfigChange={setSyntheticConfig}
                        />
                    )}
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

            <div className="mt-6 flex flex-wrap items-center gap-2">
                <StatusBadge status="current" />
                <span className="text-sm text-muted-foreground">{counts.current} current</span>
                <StatusBadge status="expired" />
                <span className="text-sm text-muted-foreground">{counts.expired} expired</span>
                <StatusBadge status="not-competent" />
                <span className="text-sm text-muted-foreground">
                    {counts.notCompetent} not competent
                </span>
                <StatusBadge status="not-assessed" />
                <span className="text-sm text-muted-foreground">
                    {counts.notAssessed} not assessed
                </span>
            </div>

            {packageSections.length === 0 ? (
                <Empty>
                    <EmptyDescription>
                        {gapsOnly
                            ? "Every assessable skill is current for this person."
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
                                            {rows.map(({ skill, competency, status }) => (
                                                <Item key={skill.id}>
                                                    <ItemContent>
                                                        <ItemTitle>{skill.name}</ItemTitle>
                                                    </ItemContent>
                                                    <ItemActions>
                                                        <span className="hidden sm:inline text-sm text-muted-foreground tabular-nums">
                                                            {competency
                                                                ? formatDate(competency.checkedAt)
                                                                : null}
                                                        </span>
                                                        <StatusBadge status={status} />
                                                    </ItemActions>
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
    );
}

function StatusBadge({ status }: { status: CompetencyStatus }) {
    return match(status)
        .with("current", () => (
            <Badge
                variant="outline"
                className="border-green-600 text-green-700 dark:text-green-500"
            >
                Current
            </Badge>
        ))
        .with("expired", () => (
            <Badge
                variant="outline"
                className="border-amber-600 text-amber-700 dark:text-amber-500"
            >
                Expired
            </Badge>
        ))
        .with("not-competent", () => <Badge variant="destructive">Not Competent</Badge>)
        .with("not-assessed", () => <Badge variant="secondary">Not Assessed</Badge>)
        .exhaustive();
}
