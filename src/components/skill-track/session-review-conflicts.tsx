/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Protect } from "@/components/protect";
import { SkillTrack_SessionReview_CardToggle } from "@/components/skill-track/session-review-card-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { useOrganization } from "@/hooks/use-organization";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillId, SkillRef } from "@/lib/schemas/skill";
import {
    assessorDisplayName,
    getSkillCheckResultLabel,
    SkillCheck,
} from "@/lib/schemas/skill-check";
import {
    isCheckIncluded,
    isConflictResolved,
    SkillCheckConflict,
} from "@/lib/skill-check-conflicts";

interface SessionReviewConflictsProps {
    /** The card's element id, for in-page links to it. */
    id?: string;
    conflicts: SkillCheckConflict<SkillCheck>[];
    /** Open the Resolve dialog for a conflict. */
    onResolve(conflict: SkillCheckConflict<SkillCheck>): void;
    assesseeById: Map<PersonId, PersonRef>;
    skillById: Map<SkillId, SkillRef>;
    assessorById: Map<PersonId, PersonRef>;
    /** The session is approved: each conflict's included check is the approval's record of it. */
    isApproved: boolean;
}

/**
 * The review page's Conflicts card: one compact row per assessee and skill with more than one
 * live check. Each row's status is read from saved statuses (Unresolved, the picked check, or all
 * excluded), and its Resolve button opens the Resolve dialog.
 */
export function SkillTrack_SessionReview_Conflicts({
    id,
    conflicts,
    onResolve,
    assesseeById,
    skillById,
    assessorById,
    isApproved,
}: SessionReviewConflictsProps) {
    const organization = useOrganization();
    const resultLabel = (result: SkillCheck["result"]) =>
        getSkillCheckResultLabel(organization.settings, result);

    const unresolved = conflicts.filter((conflict) => !isConflictResolved(conflict)).length;
    const plural = (n: number) => `${n} ${n === 1 ? "conflict" : "conflicts"}`;
    const description = isApproved
        ? `${plural(conflicts.length)} resolved at approval`
        : unresolved > 0
          ? `${unresolved} unresolved ${unresolved === 1 ? "conflict" : "conflicts"}`
          : `All ${plural(conflicts.length)} resolved`;

    return (
        <Collapsible asChild defaultOpen>
            <Card id={id} className="scroll-mt-4">
                <CardHeader>
                    <CardTitle>Conflicts</CardTitle>
                    <CardDescription>{description}</CardDescription>
                    <SkillTrack_SessionReview_CardToggle title="Conflicts" />
                </CardHeader>
                <CollapsibleContent asChild>
                    <CardContent className="flex flex-col">
                        {conflicts.map((conflict) => {
                            // The group's own ids are plain strings; its checks carry the branded ones.
                            const { assesseeId, skillId } = conflict.checks[0];
                            const assesseeName = assesseeById.get(assesseeId)?.name ?? assesseeId;
                            const skillName = skillById.get(skillId)?.name ?? skillId;

                            return (
                                <Item key={conflict.key} size="sm">
                                    {/* Full width on a phone, so the button wraps below the text. */}
                                    <ItemContent className="max-sm:basis-full">
                                        <ItemTitle>
                                            {assesseeName} · {skillName}
                                        </ItemTitle>
                                        <ItemDescription>
                                            {agreementLabel(conflict.checks, resultLabel)}
                                            {" · "}
                                            <ConflictStatus
                                                checks={conflict.checks}
                                                isApproved={isApproved}
                                                assessorById={assessorById}
                                                resultLabel={resultLabel}
                                            />
                                        </ItemDescription>
                                    </ItemContent>
                                    {!isApproved && (
                                        <Protect permissions={{ skillCheckSession: ["approve"] }}>
                                            <ItemActions>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => onResolve(conflict)}
                                                >
                                                    {isConflictResolved(conflict)
                                                        ? "Change"
                                                        : "Resolve"}
                                                </Button>
                                            </ItemActions>
                                        </Protect>
                                    )}
                                </Item>
                            );
                        })}
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}

/** "Unresolved", "Picked: Competent, Jane Smith", or "All excluded", from saved statuses. */
function ConflictStatus({
    checks,
    isApproved,
    assessorById,
    resultLabel,
}: {
    checks: SkillCheck[];
    isApproved: boolean;
    assessorById: Map<PersonId, PersonRef>;
    resultLabel: (result: SkillCheck["result"]) => string;
}) {
    const included = checks.filter(isCheckIncluded);
    if (included.length === 0) return <>All excluded</>;
    if (included.length === 1) {
        const [picked] = included;
        const assessor = picked.assessorId ? (assessorById.get(picked.assessorId) ?? null) : null;
        return (
            <>
                Picked: {resultLabel(picked.result)},{" "}
                {assessorDisplayName({ assessor, assessorLabel: picked.assessorLabel })}
            </>
        );
    }
    // Sessions approved before `approveSession` enforced one check per pair can hold more than
    // one `Include` in a conflict.
    if (isApproved) {
        return <>{included.length} included, approved before conflicts were enforced</>;
    }
    return <span className="text-destructive">Unresolved</span>;
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
