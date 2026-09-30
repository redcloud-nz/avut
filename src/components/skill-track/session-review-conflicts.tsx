/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Field,
    FieldContent,
    FieldDescription,
    FieldLabel,
    FieldTitle,
} from "@/components/ui/field";
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

    return (
        <Card>
            <CardHeader>
                <CardTitle>Conflicts</CardTitle>
                <CardDescription>
                    {showApproval
                        ? "How each conflict was resolved when the session was approved."
                        : unresolved > 0
                          ? `Resolve ${unresolved} ${unresolved === 1 ? "conflict" : "conflicts"} before approving. Pick the check to include for each assessee and skill.`
                          : "Every conflict has a pick."}
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
                {conflicts.map((conflict) => {
                    // The group's own ids are plain strings; its checks carry the branded ones.
                    const { assesseeId, skillId } = conflict.checks[0];
                    const assesseeName = assesseeById.get(assesseeId)?.name ?? assesseeId;
                    const skillName = skillById.get(skillId)?.name ?? skillId;
                    const groupIds = conflict.checks.map((c) => c.id);

                    return (
                        <section key={conflict.key} className="flex flex-col gap-2">
                            <div>
                                <div className="font-medium">
                                    {assesseeName} · {skillName}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {agreementLabel(conflict.checks, (result) =>
                                        getSkillCheckResultLabel(organization.settings, result),
                                    )}
                                </div>
                            </div>
                            <RadioGroup
                                aria-label={`${assesseeName}, ${skillName}`}
                                value={pickedId(conflict.checks) ?? ""}
                                onValueChange={(value) => {
                                    const check = conflict.checks.find((c) => c.id === value);
                                    if (check) pick(groupIds, check.id);
                                }}
                                disabled={disabled}
                            >
                                {conflict.checks.map((check) => {
                                    const assessor = check.assessorId
                                        ? (assessorById.get(check.assessorId) ?? null)
                                        : null;
                                    return (
                                        <FieldLabel key={check.id} htmlFor={`conflict-${check.id}`}>
                                            <Field orientation="horizontal">
                                                <RadioGroupItem
                                                    value={check.id}
                                                    id={`conflict-${check.id}`}
                                                />
                                                <FieldContent>
                                                    <FieldTitle>
                                                        {getSkillCheckResultLabel(
                                                            organization.settings,
                                                            check.result,
                                                        )}
                                                    </FieldTitle>
                                                    <FieldDescription>
                                                        {assessorDisplayName({
                                                            assessor,
                                                            assessorLabel: check.assessorLabel,
                                                        })}{" "}
                                                        · {formatDateTime(check.createdAt)}
                                                    </FieldDescription>
                                                    {check.notes && (
                                                        <p className="text-sm whitespace-pre-wrap">
                                                            {check.notes}
                                                        </p>
                                                    )}
                                                </FieldContent>
                                            </Field>
                                        </FieldLabel>
                                    );
                                })}
                            </RadioGroup>
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
