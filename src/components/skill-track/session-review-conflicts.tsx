/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { SkillCheckConflict } from "@/lib/skill-check-conflicts";

interface SessionReviewConflictsProps {
    conflicts: SkillCheckConflict<SkillCheck>[];
    selected: ReadonlySet<SkillCheckId>;
    /** Make `checkId` the group's pick, replacing whichever of `groupIds` was picked before. */
    pick(groupIds: SkillCheckId[], checkId: SkillCheckId): void;
    assesseeById: Map<PersonId, PersonRef>;
    skillById: Map<SkillId, SkillRef>;
    assessorById: Map<PersonId, PersonRef>;
    /** True while the session is approved, or the viewer can't approve: the radios are read-only. */
    disabled: boolean;
    /**
     * Show the approval itself (each group's `Include` check) rather than `selected`. While a
     * session is approved its conflict groups have no pick in `selected`, so this is the record
     * of how each conflict was resolved.
     */
    showApproval: boolean;
}

/**
 * The review page's Conflicts card: one radio group per assessee and skill with more than one
 * live check, for picking which check the approval includes.
 */
export function SkillTrack_SessionReview_Conflicts({
    conflicts,
    selected,
    pick,
    assesseeById,
    skillById,
    assessorById,
    disabled,
    showApproval,
}: SessionReviewConflictsProps) {
    const organization = useOrganization();
    const { formatDateTime } = usePreferences();

    const pickedId = (checks: SkillCheck[]): SkillCheckId | undefined =>
        checks.find((c) => (showApproval ? c.status === "Include" : selected.has(c.id)))?.id;

    const unresolved = conflicts.filter((conflict) => !pickedId(conflict.checks)).length;
    const plural = (n: number) => `${n} ${n === 1 ? "conflict" : "conflicts"}`;
    const description = showApproval
        ? `${plural(conflicts.length)} resolved at approval`
        : unresolved > 0
          ? `${unresolved} unresolved ${unresolved === 1 ? "conflict" : "conflicts"}`
          : `All ${plural(conflicts.length)} resolved`;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Conflicts</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                {conflicts.map((conflict) => {
                    // The group's own ids are plain strings; its checks carry the branded ones.
                    const { assesseeId, skillId } = conflict.checks[0];
                    const assesseeName = assesseeById.get(assesseeId)?.name ?? assesseeId;
                    const skillName = skillById.get(skillId)?.name ?? skillId;
                    const groupIds = conflict.checks.map((c) => c.id);
                    const headingId = `conflict-group-${conflict.checks[0].id}`;
                    // Sessions approved before `approveSession` enforced one check per pair can
                    // hold more than one `Include` in a group; the radio can only show one.
                    const multipleIncluded =
                        showApproval &&
                        conflict.checks.filter((c) => c.status === "Include").length > 1;

                    return (
                        <section key={conflict.key} className="flex flex-col gap-2">
                            <div>
                                <div id={headingId} className="font-medium">
                                    {assesseeName} · {skillName}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {agreementLabel(conflict.checks, (result) =>
                                        getSkillCheckResultLabel(organization.settings, result),
                                    )}
                                </div>
                            </div>
                            <RadioGroup
                                aria-labelledby={headingId}
                                value={pickedId(conflict.checks) ?? ""}
                                onValueChange={(value) => {
                                    const check = conflict.checks.find((c) => c.id === value);
                                    if (check) pick(groupIds, check.id);
                                }}
                                disabled={disabled}
                                // Side by side from `md`, like a merge tool's panes. `auto-fit`
                                // gives two checks half the width each and three a third, and
                                // wraps a larger group onto further rows of equal-height panes.
                                className="md:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]"
                            >
                                {conflict.checks.map((check) => {
                                    const assessor = check.assessorId
                                        ? (assessorById.get(check.assessorId) ?? null)
                                        : null;
                                    const radioId = `conflict-${check.id}`;
                                    const detailsId = `conflict-${check.id}-details`;
                                    return (
                                        <div
                                            key={check.id}
                                            className="flex flex-col overflow-hidden rounded-lg border has-data-checked:border-primary/40 has-data-checked:bg-primary/5 dark:has-data-checked:border-primary/30 dark:has-data-checked:bg-primary/10"
                                        >
                                            <Field
                                                orientation="horizontal"
                                                className="border-b bg-muted/40 px-3 py-2"
                                            >
                                                <RadioGroupItem
                                                    value={check.id}
                                                    id={radioId}
                                                    aria-describedby={detailsId}
                                                />
                                                <FieldLabel
                                                    htmlFor={radioId}
                                                    className="flex grow flex-wrap justify-between gap-x-3"
                                                >
                                                    <span className="font-medium">
                                                        {getSkillCheckResultLabel(
                                                            organization.settings,
                                                            check.result,
                                                        )}
                                                    </span>
                                                    <span className="font-normal text-muted-foreground">
                                                        {assessorDisplayName({
                                                            assessor,
                                                            assessorLabel: check.assessorLabel,
                                                        })}
                                                    </span>
                                                </FieldLabel>
                                            </Field>
                                            <div
                                                id={detailsId}
                                                className="flex flex-col gap-1 px-3 py-2 text-sm"
                                            >
                                                <span className="text-muted-foreground">
                                                    {formatDateTime(check.createdAt)}
                                                </span>
                                                {check.notes && (
                                                    <p className="whitespace-pre-wrap">
                                                        {check.notes}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </RadioGroup>
                            {multipleIncluded && (
                                <p className="text-sm text-muted-foreground">
                                    Approved before conflicts were enforced: more than one check was
                                    included.
                                </p>
                            )}
                        </section>
                    );
                })}
            </CardContent>
        </Card>
    );
}

/** "Both: Competent", "All 3: Competent", or "Results differ". */
function agreementLabel(
    checks: SkillCheck[],
    resultLabel: (result: SkillCheck["result"]) => string,
): string {
    const first = checks[0].result;
    if (checks.some((c) => c.result !== first)) return "Results differ";
    const prefix = checks.length === 2 ? "Both" : `All ${checks.length}`;
    return `${prefix}: ${resultLabel(first)}`;
}
