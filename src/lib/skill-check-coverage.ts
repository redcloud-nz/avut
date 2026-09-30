/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Coverage of a session's skill checks: which assessee and skill pairs were never assessed.
 *
 * A pair is "not assessed" when the session has no live (non-`Deleted`) check for it. The pairs
 * come from the session's currently **assigned** assessees and skills, not from everyone who has
 * a check: a person or skill that's no longer assigned but still has checks isn't a gap anyone
 * intends to fill, so passing the wider lists would report gaps that don't matter.
 *
 * No server imports: this module runs in the browser.
 */

import { pairKey } from "@/lib/skill-check-conflicts";

/** The fields coverage reads. Structural, so raw Prisma rows and `SkillCheck`s both fit. */
export interface CoverageCheckFields {
    assesseeId: string;
    skillId: string;
    status: string;
}

/** One assessee and the skills they're missing, in the order of the skill list passed in. */
export interface NotAssessed<A extends string, S extends string> {
    assesseeId: A;
    skillIds: S[];
}

/**
 * The assigned pairs with no live check, grouped by assessee. Entries follow `assesseeIds`, each
 * entry's `skillIds` follow `skillIds`, and an assessee with no gaps is left out. Checks for an
 * assessee or skill not in the lists are ignored.
 */
export function findNotAssessed<A extends string, S extends string>(
    assesseeIds: readonly A[],
    skillIds: readonly S[],
    checks: readonly CoverageCheckFields[],
): NotAssessed<A, S>[] {
    const covered = new Set<string>();
    for (const check of checks) {
        if (check.status === "Deleted") continue;
        covered.add(pairKey(check.assesseeId, check.skillId));
    }

    const result: NotAssessed<A, S>[] = [];
    for (const assesseeId of assesseeIds) {
        const missing = skillIds.filter((skillId) => !covered.has(pairKey(assesseeId, skillId)));
        if (missing.length > 0) result.push({ assesseeId, skillIds: missing });
    }
    return result;
}
