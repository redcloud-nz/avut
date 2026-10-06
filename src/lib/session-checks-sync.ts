/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { PersonId } from "@/lib/schemas/person";
import type { SkillId } from "@/lib/schemas/skill";
import type { SessionCheck, SkillCheck, SkillCheckResultValue } from "@/lib/schemas/skill-check";
import type { SkillCheckSession } from "@/lib/schemas/skill-check-session";

/*
 * Pure helpers for keeping a session's checks in sync across assessors: the session cache
 * (`listSessionChecks`) and the caller's own-checks list (`listSkillChecks` with
 * `ownChecksOnly`). No React or tRPC here, so the merge rules can be tested on their own.
 *
 * The one merge rule everywhere is "newer-or-equal `recordedAt` wins": the poll's cursor lags the
 * server clock, so rows arrive more than once and out of order with local writes, and the merge
 * has to be idempotent.
 */

/**
 * The session cache's data: `listSessionChecks`' output, cached under its key without `since`.
 * `checks` holds every assessor's rows, `Deleted` tombstones included, and `cursor` is the
 * `since` for the next poll.
 */
export interface SessionChecksData {
    checks: SessionCheck[];
    cursor: string;
    sessionStatus: SkillCheckSession["status"];
}

/** Identifies one check on a session's recording page: the (assessee, skill) pair. */
export type SessionCheckKey = `${PersonId}::${SkillId}`;

export function sessionCheckKey(assesseeId: PersonId, skillId: SkillId): SessionCheckKey {
    return `${assesseeId}::${skillId}`;
}

function stamp(check: { recordedAt: string }): number {
    return Date.parse(check.recordedAt);
}

/**
 * Whether a session check carries its assessee, skill and assessor names. A row a local write
 * added has them as `""` until the next poll's copy fills them in; consumers skip it until then.
 */
function hasNames(check: SessionCheck): boolean {
    return check.assesseeName !== "" && check.skillName !== "" && check.assessorName !== "";
}

/** Whether two rows have the same fields with the same values (shallow). */
function sameFields<T extends object>(a: T, b: T): boolean {
    const keys = Object.keys(a) as (keyof T)[];
    return keys.length === Object.keys(b).length && keys.every((key) => Object.is(a[key], b[key]));
}

/**
 * Merges `incoming` rows into a session's cached checks, per id: a row replaces the cached one
 * when its `recordedAt` is the same or later, and a row with an unknown id is added. An equal stamp
 * is the same version of the row, which lets a poll's copy fill in the names on a row a local
 * write added without them. `Deleted` tombstones are kept like any other row, so a stale live row
 * can't bring a removed check back.
 *
 * @returns
 * - `checks`: the merged list. An incoming row identical to the cached one leaves it as it is, so
 *   when no row changes anything, `checks` is the same `cached` array and subscribers don't
 *   re-render.
 * - `applied`: every incoming row that won the merge, identical re-sends included. Pass these to
 *   `patchOwnChecks`. The lagged cursor re-sends each row about once more, and handing the
 *   identical copy on too lets the own-checks list heal when an own-list refetch that read before
 *   the write overwrote the first patch.
 */
export function mergeSessionChecks(
    cached: SessionCheck[],
    incoming: SessionCheck[],
): { checks: SessionCheck[]; applied: SessionCheck[] } {
    const indexById = new Map(cached.map((check, index) => [check.id, index]));
    let checks = cached;
    const applied: SessionCheck[] = [];

    for (const row of incoming) {
        const index = indexById.get(row.id);
        if (index === undefined) {
            if (checks === cached) checks = [...cached];
            indexById.set(row.id, checks.length);
            checks.push(row);
            applied.push(row);
            continue;
        }
        const current = checks[index];
        if (stamp(row) < stamp(current)) continue;
        applied.push(row);
        if (sameFields(row, current)) continue;
        if (checks === cached) checks = [...cached];
        checks[index] = row;
    }

    return { checks, applied };
}

function toSkillCheck(check: SessionCheck): SkillCheck {
    const { assesseeName: _assessee, skillName: _skill, assessorName: _assessor, ...rest } = check;
    return rest;
}

/**
 * Applies the session merge's `applied` rows to the caller's own-checks list, so a check recorded
 * or removed on another device shows up here. Only rows whose `assessorId` is `selfPersonId`
 * count, matched to own rows by their (assessee, skill) pair.
 *
 * - A live row replaces the own row, or is added, when its `recordedAt` is at least the own row's.
 * - A `Deleted` row removes the own row when its `recordedAt` is at least the own row's.
 *
 * So a poll response that was in flight can't undo a newer local write. A live row whose
 * `SkillCheck` fields equal the own row's is skipped, which covers an identical re-send and a
 * poll that only fills in the names on a local write.
 *
 * @returns the patched list, stripped to the `SkillCheck` shape; the same `own` array when
 * nothing changes; and `undefined` when the list isn't cached.
 */
export function patchOwnChecks(
    own: SkillCheck[] | undefined,
    applied: SessionCheck[],
    selfPersonId: PersonId,
): SkillCheck[] | undefined {
    if (own === undefined) return undefined;

    let result = own;
    for (const row of applied) {
        if (row.assessorId !== selfPersonId) continue;

        const index = result.findIndex(
            (check) => check.assesseeId === row.assesseeId && check.skillId === row.skillId,
        );
        const current = index === -1 ? undefined : result[index];
        if (current && stamp(row) < stamp(current)) continue;

        if (row.status === "Deleted") {
            if (!current) continue;
            result = result.filter((_, i) => i !== index);
            continue;
        }
        const next = toSkillCheck(row);
        if (!current) {
            result = [...result, next];
        } else if (!sameFields(next, current)) {
            result = result.map((check, i) => (i === index ? next : check));
        }
    }
    return result;
}

/** The later of two `listSessionChecks` cursors (ISO datetimes). */
export function maxCursor(a: string | undefined, b: string): string {
    if (a === undefined) return b;
    return Date.parse(a) > Date.parse(b) ? a : b;
}

/** Another assessor's check on one (assessee, skill) pair, for the row's "Also checked by" marker. */
export interface OtherAssessorCheck {
    assessorName: string;
    result: SkillCheckResultValue;
}

/**
 * The other assessors' live checks, keyed by `sessionCheckKey`, each list sorted by
 * `assessorName`. Leaves out tombstones, the caller's own checks, and rows whose names haven't
 * arrived yet (a local write's row, until the next poll fills them in).
 */
export function otherAssessorChecks(
    checks: SessionCheck[],
    selfPersonId: PersonId,
): Map<SessionCheckKey, OtherAssessorCheck[]> {
    const map = new Map<SessionCheckKey, OtherAssessorCheck[]>();
    for (const check of checks) {
        if (check.status === "Deleted") continue;
        if (check.assessorId === selfPersonId) continue;
        if (!hasNames(check)) continue;

        const key = sessionCheckKey(check.assesseeId, check.skillId);
        const entry = { assessorName: check.assessorName, result: check.result };
        const list = map.get(key);
        if (list) list.push(entry);
        else map.set(key, [entry]);
    }
    for (const list of map.values()) {
        list.sort((a, b) => a.assessorName.localeCompare(b.assessorName));
    }
    return map;
}
