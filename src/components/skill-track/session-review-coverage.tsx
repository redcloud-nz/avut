/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronRightIcon } from "lucide-react";

import { ReviewChecksSubject } from "@/components/skill-track/review-checks-dialog";
import { SkillTrack_SessionReview_CardToggle } from "@/components/skill-track/session-review-card-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillId, SkillRef } from "@/lib/schemas/skill";
import { SkillCheck, SkillCheckId } from "@/lib/schemas/skill-check";
import { isCheckIncluded } from "@/lib/skill-check-conflicts";
import { Coverage } from "@/lib/skill-check-coverage";

interface SessionReviewCoverageProps {
    /** The element id of the pair of cards, for in-page links to them. */
    id?: string;
    /** Coverage per assessee: everyone assigned, plus anyone no longer assigned who has checks. */
    people: Coverage<PersonId, SkillCheck>[];
    /** Coverage per skill, on the same terms. */
    skills: Coverage<SkillId, SkillCheck>[];
    /** How many people there are with the unassessed counted, when `people` leaves them out. */
    peopleCount: number;
    /** How many skills there are with the unassessed counted, when `skills` leaves them out. */
    skillsCount: number;
    assesseeById: Map<PersonId, PersonRef>;
    skillById: Map<SkillId, SkillRef>;
    /** The checks in a conflict group: their pick is shown in the Conflicts card, so the excluded counts leave them out. */
    conflictCheckIds: ReadonlySet<SkillCheckId>;
    /** Open a person's (or a skill's) checks in the review dialog, which the page hosts. */
    onOpen(subject: ReviewChecksSubject): void;
}

/**
 * The review page's Personnel and Skills cards, side by side: each person (or skill) with their
 * check count, how much of the session they cover, and how many of their checks are excluded.
 * Clicking one opens its checks in the review dialog (`SkillsModule_ReviewChecks_Dialog`, hosted
 * by the page), where they can be excluded one by one. Everything starts included, so the cards
 * are for spotting gaps and the odd exclusion, not for ticking.
 */
export function SkillTrack_SessionReview_Coverage({
    id,
    people,
    skills,
    peopleCount,
    skillsCount,
    assesseeById,
    skillById,
    conflictCheckIds,
    onOpen,
}: SessionReviewCoverageProps) {
    const personName = (id: PersonId) => assesseeById.get(id)?.name ?? id;
    const skillName = (id: SkillId) => skillById.get(id)?.name ?? id;

    return (
        <div id={id} className="grid scroll-mt-4 gap-4 md:grid-cols-2">
            <CoverageCard
                title="Personnel"
                entries={people}
                allCount={peopleCount}
                name={personName}
                coverageOf="skills"
                conflictCheckIds={conflictCheckIds}
                onOpen={(id) => onOpen({ kind: "person", id })}
            />
            <CoverageCard
                title="Skills"
                entries={skills}
                allCount={skillsCount}
                name={skillName}
                coverageOf="personnel"
                conflictCheckIds={conflictCheckIds}
                onOpen={(id) => onOpen({ kind: "skill", id })}
            />
        </div>
    );
}

/** An entry's check count and coverage ("3 checks · 50% of skills"), for its row and its dialog. */
export function coverageSummary(
    entry: Coverage<string, SkillCheck>,
    coverageOf: "skills" | "personnel",
) {
    if (entry.checks.length === 0) return "No checks recorded";
    const checks = `${entry.checks.length} ${entry.checks.length === 1 ? "check" : "checks"}`;
    if (entry.total === 0) return checks;
    return `${checks} · ${Math.round((entry.covered / entry.total) * 100)}% of ${coverageOf}`;
}

function CoverageCard<Id extends string>({
    title,
    entries,
    allCount,
    name,
    coverageOf,
    conflictCheckIds,
    onOpen,
}: {
    title: string;
    entries: Coverage<Id, SkillCheck>[];
    /** The entry count with the unassessed included, whether or not `entries` leaves them out. */
    allCount: number;
    name(id: Id): string;
    coverageOf: "skills" | "personnel";
    conflictCheckIds: ReadonlySet<SkillCheckId>;
    onOpen(id: Id): void;
}) {
    // How many have checks, out of everyone: leaving the unassessed out of the list would make
    // this always "N of N", so it counts them regardless, and says so with "Showing".
    const withChecks = entries.filter((entry) => entry.checks.length > 0).length;
    const withChecksPercent = allCount === 0 ? 0 : Math.round((withChecks / allCount) * 100);
    const showing = allCount > entries.length;
    // The mean number of the other side each entry covers, and that as a share of the other side.
    const total = entries[0]?.total ?? 0;
    const meanCovered =
        entries.length === 0
            ? 0
            : entries.reduce((sum, entry) => sum + entry.covered, 0) / entries.length;
    const meanPercent = total === 0 ? 0 : Math.round((meanCovered / total) * 100);

    return (
        <Collapsible asChild defaultOpen>
            <Card>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>
                        <p>
                            {showing
                                ? `Showing ${withChecks} of ${allCount} (${withChecksPercent}%) with checks recorded.`
                                : `${withChecks} of ${allCount} (${withChecksPercent}%) ${withChecks === 1 ? "has" : "have"} checks recorded.`}
                        </p>
                        <p>
                            Average {meanCovered.toFixed(1)} checks ({meanPercent}% coverage)
                        </p>
                    </CardDescription>
                    <SkillTrack_SessionReview_CardToggle title={title} />
                </CardHeader>
                <CollapsibleContent asChild>
                    <CardContent className="flex flex-col has-data-[slot=item]:-my-2.5 has-data-[slot=item]:px-1">
                        {entries.length === 0 && (
                            <p className="text-sm text-muted-foreground">No checks recorded.</p>
                        )}
                        {entries.map((entry) => {
                            // Checks left out by hand. A conflict's unpicked checks are left out by the
                            // pick, which the Conflicts card already shows.
                            const excluded = entry.checks.filter(
                                (check) =>
                                    !conflictCheckIds.has(check.id) && !isCheckIncluded(check),
                            ).length;
                            const content = (
                                <>
                                    <ItemContent>
                                        <ItemTitle>{name(entry.id)}</ItemTitle>
                                        <ItemDescription>
                                            {coverageSummary(entry, coverageOf)}
                                        </ItemDescription>
                                    </ItemContent>
                                    <ItemActions>
                                        {excluded > 0 && (
                                            <Badge variant="secondary">{excluded} excluded</Badge>
                                        )}
                                        {entry.checks.length > 0 && (
                                            <ChevronRightIcon className="size-4" />
                                        )}
                                    </ItemActions>
                                </>
                            );
                            // Nothing to open for someone (or something) with no checks.
                            return entry.checks.length > 0 ? (
                                <Item key={entry.id} size="sm" asChild className="hover:bg-muted">
                                    <button type="button" onClick={() => onOpen(entry.id)}>
                                        {content}
                                    </button>
                                </Item>
                            ) : (
                                <Item key={entry.id} size="sm">
                                    {content}
                                </Item>
                            );
                        })}
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
