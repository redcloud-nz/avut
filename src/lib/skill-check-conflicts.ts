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

/** The fields conflict detection reads. Structural, so raw Prisma rows and `SkillCheck`s both fit. */
export interface ConflictCheckFields {
    id: string;
    assesseeId: string;
    skillId: string;
    status: string;
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

/** The fields the selection rules read: conflict detection's, plus when the check last changed. */
export interface SelectionCheckFields extends ConflictCheckFields {
    updatedAt: string;
}

/**
 * A conflict group's identity for reconciling the selection: its members' `id:status:updatedAt`,
 * sorted. A member joining, leaving or being re-recorded changes it.
 */
function groupSignature(checks: SelectionCheckFields[]): string {
    return checks
        .map((c) => `${c.id}:${c.status}:${c.updatedAt}`)
        .sort()
        .join("|");
}

/** A check outside any conflict group starts ticked unless it's `Exclude`. */
function startsTicked(check: SelectionCheckFields): boolean {
    return check.status !== "Exclude";
}

/**
 * A conflict group's starting pick: its one `Pending` check if it has exactly one and no `Draft`
 * (included before a reopen, nothing recorded or edited since), otherwise nothing.
 */
function initialPick<T extends SelectionCheckFields>(group: T[]): T["id"] | null {
    const pending = group.filter((c) => c.status === "Pending");
    if (pending.length !== 1) return null;
    if (group.some((c) => c.status === "Draft")) return null;
    return pending[0].id;
}

/** Add a group's starting selection to `into`: its pick if a conflict, else the check if ticked. */
function addInitial<T extends SelectionCheckFields>(group: T[], into: Set<T["id"]>) {
    if (group.length > 1) {
        const pick = initialPick(group);
        if (pick !== null) into.add(pick);
    } else if (startsTicked(group[0])) {
        into.add(group[0].id);
    }
}

/**
 * The review page's starting selection. A check outside any conflict group is ticked unless it's
 * `Exclude`. A conflict group starts with nothing picked, unless it has exactly one `Pending`
 * check and no `Draft`, which is then picked. `Deleted` checks are never selected.
 */
export function initialSelection<T extends SelectionCheckFields>(checks: T[]): Set<T["id"]> {
    const selected = new Set<T["id"]>();
    for (const group of groupChecksByPair(checks).values()) addInitial(group, selected);
    return selected;
}

/**
 * Carry the selection across a refetch of the checks, from `prevChecks` to `nextChecks`.
 *
 * - A conflict group whose signature is unchanged keeps the user's pick.
 * - A conflict group that's new, or whose signature changed (a member joined, left, or was
 *   re-recorded), loses its pick, and the starting rules apply again.
 * - A check that was already on its own keeps the user's tick or untick.
 * - Any other check outside a group (new, or left behind by a shrinking group) is ticked unless
 *   it's `Exclude`.
 *
 * Ids no longer among the live checks are dropped.
 */
export function reconcileSelection<T extends SelectionCheckFields>(
    prevChecks: T[],
    nextChecks: T[],
    selected: ReadonlySet<T["id"]>,
): Set<T["id"]> {
    const prevGroups = groupChecksByPair(prevChecks);
    const result = new Set<T["id"]>();

    for (const [key, group] of groupChecksByPair(nextChecks)) {
        const prevGroup = prevGroups.get(key);

        if (group.length > 1) {
            const unchanged =
                prevGroup !== undefined &&
                prevGroup.length > 1 &&
                groupSignature(prevGroup) === groupSignature(group);
            if (unchanged) {
                for (const c of group) if (selected.has(c.id)) result.add(c.id);
            } else {
                addInitial(group, result);
            }
            continue;
        }

        const check = group[0];
        const wasAlone = prevGroup?.length === 1 && prevGroup[0].id === check.id;
        if (wasAlone ? selected.has(check.id) : startsTicked(check)) result.add(check.id);
    }

    return result;
}
