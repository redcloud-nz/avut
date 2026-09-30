/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { SkillTrack_SessionReview_CardToggle } from "@/components/skill-track/session-review-card-toggle";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@/hooks/use-organization";
import { usePreferences } from "@/hooks/use-preferences";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillId, SkillRef } from "@/lib/schemas/skill";
import {
    assessorDisplayName,
    getSkillCheckResultLabel,
    SkillCheck,
    SkillCheckId,
} from "@/lib/schemas/skill-check";
import { Coverage } from "@/lib/skill-check-coverage";

interface SessionReviewCoverageProps {
    /** The element id of the pair of cards, for in-page links to them. */
    id?: string;
    /** Coverage per assessee: everyone assigned, plus anyone no longer assigned who has checks. */
    people: Coverage<PersonId, SkillCheck>[];
    /** Coverage per skill, on the same terms. */
    skills: Coverage<SkillId, SkillCheck>[];
    assesseeById: Map<PersonId, PersonRef>;
    skillById: Map<SkillId, SkillRef>;
    assessorById: Map<PersonId, PersonRef>;
    selected: ReadonlySet<SkillCheckId>;
    /** The checks in a conflict group: their pick is made in the Conflicts card, so here they only show it. */
    conflictCheckIds: ReadonlySet<SkillCheckId>;
    /** True while the session is approved, or the viewer can't approve: the checkboxes are read-only. */
    disabled: boolean;
    /** Show the approval itself (`Include` checks) rather than the local selection. */
    showApproval: boolean;
    toggleCheck(id: SkillCheckId): void;
}

type Subject = { kind: "person"; id: PersonId } | { kind: "skill"; id: SkillId };

/**
 * The review page's People and Skills cards, side by side: each person (or skill) with their
 * check count, how much of the session they cover, and how many of their checks are excluded.
 * Clicking one opens its checks in a dialog, where they can be excluded one by one. Everything
 * starts included, so the cards are for spotting gaps and the odd exclusion, not for ticking.
 */
export function SkillTrack_SessionReview_Coverage({
    id,
    people,
    skills,
    assesseeById,
    skillById,
    ...checkProps
}: SessionReviewCoverageProps) {
    const [subject, setSubject] = useState<Subject | null>(null);
    const isIncluded = (check: SkillCheck) =>
        checkProps.showApproval ? check.status === "Include" : checkProps.selected.has(check.id);

    const personName = (id: PersonId) => assesseeById.get(id)?.name ?? id;
    const skillName = (id: SkillId) => skillById.get(id)?.name ?? id;

    // Looked up on each render, so the dialog follows the selection and any refetch.
    const open =
        subject?.kind === "person"
            ? people.find((entry) => entry.id === subject.id)
            : subject?.kind === "skill"
              ? skills.find((entry) => entry.id === subject.id)
              : undefined;

    return (
        <div id={id} className="grid scroll-mt-4 gap-4 md:grid-cols-2">
            <CoverageCard
                title="Personnel"
                entries={people}
                name={personName}
                coverageOf="skills"
                isIncluded={isIncluded}
                conflictCheckIds={checkProps.conflictCheckIds}
                onOpen={(id) => setSubject({ kind: "person", id })}
            />
            <CoverageCard
                title="Skills"
                entries={skills}
                name={skillName}
                coverageOf="people"
                isIncluded={isIncluded}
                conflictCheckIds={checkProps.conflictCheckIds}
                onOpen={(id) => setSubject({ kind: "skill", id })}
            />
            <Dialog open={open !== undefined} onOpenChange={(next) => !next && setSubject(null)}>
                {open && subject && (
                    <DialogContent size="lg">
                        <DialogHeader>
                            <DialogTitle>
                                {subject.kind === "person"
                                    ? personName(subject.id)
                                    : skillName(subject.id)}
                            </DialogTitle>
                            <DialogDescription>
                                {summary(open, subject.kind === "person" ? "skills" : "people")}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogBody>
                            <ul className="flex flex-col gap-3">
                                {open.checks
                                    .map((check) => ({
                                        check,
                                        label:
                                            subject.kind === "person"
                                                ? skillName(check.skillId)
                                                : personName(check.assesseeId),
                                    }))
                                    .toSorted((a, b) => a.label.localeCompare(b.label))
                                    .map(({ check, label }) => (
                                        <CheckRow
                                            key={check.id}
                                            check={check}
                                            label={label}
                                            included={isIncluded(check)}
                                            {...checkProps}
                                        />
                                    ))}
                            </ul>
                        </DialogBody>
                        <DialogFooter showCloseButton />
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}

function summary(entry: Coverage<string, SkillCheck>, coverageOf: "skills" | "people") {
    if (entry.checks.length === 0) return "No checks recorded";
    const checks = `${entry.checks.length} ${entry.checks.length === 1 ? "check" : "checks"}`;
    if (entry.total === 0) return checks;
    return `${checks} · ${Math.round((entry.covered / entry.total) * 100)}% of ${coverageOf}`;
}

function CoverageCard<Id extends string>({
    title,
    entries,
    name,
    coverageOf,
    isIncluded,
    conflictCheckIds,
    onOpen,
}: {
    title: string;
    entries: Coverage<Id, SkillCheck>[];
    name(id: Id): string;
    coverageOf: "skills" | "people";
    isIncluded(check: SkillCheck): boolean;
    conflictCheckIds: ReadonlySet<SkillCheckId>;
    onOpen(id: Id): void;
}) {
    const percent = (n: number) =>
        entries.length === 0 ? 0 : Math.round((n / entries.length) * 100);
    const withChecks = entries.filter((entry) => entry.checks.length > 0).length;
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
                            {withChecks} of {entries.length} ({percent(withChecks)}%){" "}
                            {withChecks === 1 ? "has" : "have"} checks recorded.
                        </p>
                        <p>
                            Average {meanCovered.toFixed(1)} ({meanPercent}%) coverage
                        </p>
                    </CardDescription>
                    <SkillTrack_SessionReview_CardToggle title={title} />
                </CardHeader>
                <CollapsibleContent asChild>
                    <CardContent className="flex flex-col">
                        {entries.map((entry) => {
                            // Checks left out by hand. A conflict's unpicked checks are left out by the
                            // pick, which the Conflicts card already shows.
                            const excluded = entry.checks.filter(
                                (check) => !conflictCheckIds.has(check.id) && !isIncluded(check),
                            ).length;
                            const content = (
                                <>
                                    <ItemContent>
                                        <ItemTitle>{name(entry.id)}</ItemTitle>
                                        <ItemDescription>
                                            {summary(entry, coverageOf)}
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

function CheckRow({
    check,
    label,
    included,
    assessorById,
    conflictCheckIds,
    disabled,
    toggleCheck,
}: {
    check: SkillCheck;
    /** The skill's name in a person's dialog, the assessee's in a skill's. */
    label: string;
    included: boolean;
} & Pick<
    SessionReviewCoverageProps,
    "assessorById" | "conflictCheckIds" | "disabled" | "toggleCheck"
>) {
    const organization = useOrganization();
    const { formatDateTime } = usePreferences();
    const checkboxId = `check-${check.id}`;
    const inConflict = conflictCheckIds.has(check.id);
    const assessor = check.assessorId ? (assessorById.get(check.assessorId) ?? null) : null;

    return (
        <li className="flex items-start gap-3">
            <Checkbox
                id={checkboxId}
                className="mt-0.5"
                checked={included}
                disabled={disabled || inConflict}
                onCheckedChange={() => toggleCheck(check.id)}
            />
            <div className="flex min-w-0 grow flex-col gap-1 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <Label htmlFor={checkboxId} className="leading-snug">
                        {label}
                    </Label>
                    <span>{getSkillCheckResultLabel(organization.settings, check.result)}</span>
                </div>
                <div className="text-muted-foreground">
                    {assessorDisplayName({ assessor, assessorLabel: check.assessorLabel })} ·{" "}
                    {formatDateTime(check.createdAt)}
                    {inConflict && " · picked in Conflicts"}
                </div>
                {check.notes && (
                    <p className="wrap-break-word whitespace-pre-wrap">{check.notes}</p>
                )}
            </div>
        </li>
    );
}
