/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Coverage of a session's skill checks, per assessee or per skill: which checks they have, and how
 * much of the other side of the session those checks cover.
 *
 * For an assessee, coverage is how many of the session's currently **assigned** skills they have
 * at least one live (non-`Deleted`) check for; for a skill, how many of the assigned assessees
 * have one. Checks against someone or something no longer assigned still belong to the entry,
 * but don't count towards its coverage, so it can't pass 100%.
 *
 * No server imports: this module runs in the browser.
 */

/** The fields coverage reads. Structural, so raw Prisma rows and `SkillCheck`s both fit. */
export interface CoverageCheckFields {
    assesseeId: string;
    skillId: string;
    status: string;
}

/** One assessee's (or skill's) live checks and how far they reach. */
export interface Coverage<Id extends string, T extends CoverageCheckFields> {
    id: Id;
    /** The entry's live checks, in the order passed in. */
    checks: T[];
    /** How many of the assigned ids on the other side have at least one of those checks. */
    covered: number;
    /** How many ids are assigned on the other side: the most `covered` can be. */
    total: number;
}

/**
 * Coverage for each of `ids`, in that order, including those with no checks. `by` says which
 * side `ids` are on; `assignedOtherIds` are the assigned ids on the other side.
 */
export function coverageBy<Id extends string, T extends CoverageCheckFields>(
    by: "assessee" | "skill",
    ids: readonly Id[],
    assignedOtherIds: readonly string[],
    checks: readonly T[],
): Coverage<Id, T>[] {
    const own = (check: T) => (by === "assessee" ? check.assesseeId : check.skillId);
    const other = (check: T) => (by === "assessee" ? check.skillId : check.assesseeId);
    const assignedOther = new Set(assignedOtherIds);

    const checksById = new Map<string, T[]>();
    for (const check of checks) {
        if (check.status === "Deleted") continue;
        const list = checksById.get(own(check));
        if (list) list.push(check);
        else checksById.set(own(check), [check]);
    }

    return ids.map((id) => {
        const idChecks = checksById.get(id) ?? [];
        const covered = new Set(idChecks.map(other).filter((o) => assignedOther.has(o)));
        return { id, checks: idChecks, covered: covered.size, total: assignedOther.size };
    });
}
