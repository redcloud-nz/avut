/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PersonId, PersonRef } from "@/lib/schemas/person";
import { SkillId, SkillRef } from "@/lib/schemas/skill";
import { NotAssessed } from "@/lib/skill-check-coverage";

interface SessionReviewNotAssessedProps {
    /** The card's element id, for in-page links to it. */
    id?: string;
    /** One entry per assigned assessee missing at least one assigned skill (`findNotAssessed`). */
    notAssessed: NotAssessed<PersonId, SkillId>[];
    assesseeById: Map<PersonId, PersonRef>;
    skillById: Map<SkillId, SkillRef>;
}

/**
 * The review page's Not assessed card: for each assigned assessee, the assigned skills with no
 * live check in the session. For information only; it never blocks Approve.
 */
export function SkillTrack_SessionReview_NotAssessed({
    id,
    notAssessed,
    assesseeById,
    skillById,
}: SessionReviewNotAssessedProps) {
    const pairCount = notAssessed.reduce((sum, entry) => sum + entry.skillIds.length, 0);
    const personCount = notAssessed.length;
    const description = `${pairCount} ${pairCount === 1 ? "skill check" : "skill checks"} not recorded across ${personCount} ${personCount === 1 ? "person" : "people"}`;

    return (
        <Card id={id} className="scroll-mt-4">
            <CardHeader>
                <CardTitle>Not assessed</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="flex flex-col gap-3">
                    {notAssessed.map((entry) => (
                        <li
                            key={entry.assesseeId}
                            className="flex flex-col gap-x-3 md:flex-row md:items-baseline"
                        >
                            <span className="shrink-0 font-medium">
                                {assesseeById.get(entry.assesseeId)?.name ?? entry.assesseeId}
                            </span>
                            <span className="text-muted-foreground">
                                {entry.skillIds
                                    .map((skillId) => skillById.get(skillId)?.name ?? skillId)
                                    .join(", ")}
                            </span>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}
