/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Conflict detection for the skill checks in a session, shared by the client (review page,
 * session page) and the server (`approveSession`'s guard), so the two can't disagree.
 *
 * A conflict is one assessee and skill with more than one live (non-`Deleted`) check. The
 * check's unique key includes the assessor, so that means more than one assessor; counting
 * checks rather than distinct assessors also catches two purged assessors (`assessorId: null`).
 *
 * No server imports: this module runs in the browser too.
 */

import type { SkillCheck } from "@/lib/schemas/skill-check";

/** The fields conflict detection reads. Structural, so raw Prisma rows and `SkillCheck`s both fit. */
export interface ConflictCheckFields {
    id: string;
    assesseeId: string;
    skillId: string;
    status: SkillCheck["status"];
}

export interface SkillCheckConflict<T extends ConflictCheckFields> {
    key: string;
    assesseeId: string;
    skillId: string;
    checks: T[];
}

/** The grouping key for one assessee and skill. */
export function pairKey(assesseeId: string, skillId: string): string {
    return `${assesseeId}:${skillId}`;
}

/**
 * Group the live (non-`Deleted`) checks by assessee and skill, keeping insertion order both
 * of the groups and of the checks within each group.
 */
export function groupChecksByPair<T extends ConflictCheckFields>(checks: T[]): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const check of checks) {
        if (check.status === "Deleted") continue;
        const key = pairKey(check.assesseeId, check.skillId);
        const group = groups.get(key);
        if (group) group.push(check);
        else groups.set(key, [check]);
    }
    return groups;
}

/** The pairs with more than one live check, in the order their first check appears. */
export function findConflicts<T extends ConflictCheckFields>(checks: T[]): SkillCheckConflict<T>[] {
    const conflicts: SkillCheckConflict<T>[] = [];
    for (const [key, group] of groupChecksByPair(checks)) {
        if (group.length < 2) continue;
        conflicts.push({
            key,
            assesseeId: group[0].assesseeId,
            skillId: group[0].skillId,
            checks: group,
        });
    }
    return conflicts;
}

/**
 * Whether a live check is included, read from its saved status: anything but `Exclude`. Before
 * approval that's `Draft` or `Pending` (the review page saves an exclusion as `Exclude`); after
 * it, the approval's `Include` stamp. `approveSession` compares its confirmation against this.
 */
export function isCheckIncluded(check: Pick<ConflictCheckFields, "status">): boolean {
    return check.status !== "Exclude";
}

/**
 * Whether a conflict is resolved: at most one of its checks is included, so either one check
 * is picked and the rest are excluded, or every check is excluded. It's read from saved statuses,
 * so a conflict can be resolved without anyone picking, e.g. when a reopen carries over the
 * previous approval's pick.
 */
export function isConflictResolved(conflict: SkillCheckConflict<ConflictCheckFields>): boolean {
    return conflict.checks.filter(isCheckIncluded).length <= 1;
}
