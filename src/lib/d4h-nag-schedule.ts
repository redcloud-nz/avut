/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { TZDate } from "@date-fns/tz";

/*
 * Schedule maths for D4H attendance reminder rules. A rule fires once a week, at `hour`:00 on
 * `weekday` (0–6, Sunday = 0, as `Date.getDay()`), in the org's `general.timeZone`.
 *
 * DST: a slot is built from the local date and hour (`zonedWallClockToInstant`), never by adding
 * hours or 7 × 24h to an instant, so it stays on the wall-clock hour across a transition. The two
 * hours DST makes odd resolve like this (NZ times as the example):
 *
 * - **An hour that doesn't exist** (spring forward, 02:00 → 03:00): the slot is the instant the
 *   clocks jump, the same instant as 03:00 that day.
 * - **An hour that happens twice** (fall back, 03:00 → 02:00): the slot is the first occurrence,
 *   still on daylight time. The repeat an hour later is not a second slot.
 */

const HOUR_MS = 60 * 60_000;

/** How soon an exercise can start and still be worth a reminder: the "too close to be useful" guard. */
export const MIN_LEAD_MS = HOUR_MS;

export interface RuleSchedule {
    /** 0–6, Sunday = 0. */
    weekday: number;
    /** 0–23. */
    hour: number;
}

/** The exercise start range a run looks at, inclusive at both ends. */
export interface NagWindow {
    start: Date;
    end: Date;
}

/** The rule's latest slot at or before `now`: `weekday` at `hour`:00 in `timeZone`. */
export function latestSlot({ weekday, hour }: RuleSchedule, timeZone: string, now: Date): Date {
    const local = new TZDate(now, timeZone);
    const daysBack = (local.getDay() - weekday + 7) % 7;
    const slotOn = (daysAgo: number) =>
        zonedWallClockToInstant(
            Date.UTC(local.getFullYear(), local.getMonth(), local.getDate() - daysAgo, hour),
            timeZone,
        );

    const slot = slotOn(daysBack);
    // Same weekday as today but the hour hasn't come yet: the slot is last week's.
    return slot.getTime() > now.getTime() ? slotOn(daysBack + 7) : slot;
}

/**
 * The instant at which `timeZone`'s wall clock reads `wallMs` (a local date-time encoded as if it
 * were UTC). Disambiguates like Temporal's `"compatible"`: a time that happens twice gives the
 * earlier instant; a time skipped by a forward jump is read with the offset from before the jump,
 * which lands that far past the jump (an on-the-hour skipped hour lands exactly on it).
 *
 * Done by hand because the `TZDate` constructor picks a repeated hour's occurrence inconsistently.
 * Assumes at most one transition within a day either side, which holds for every IANA zone.
 */
function zonedWallClockToInstant(wallMs: number, timeZone: string): Date {
    const offsetBefore = offsetMs(wallMs - 24 * HOUR_MS, timeZone);
    const offsetAfter = offsetMs(wallMs + 24 * HOUR_MS, timeZone);
    const valid = [wallMs - offsetBefore, wallMs - offsetAfter].filter(
        (instant) => instant + offsetMs(instant, timeZone) === wallMs,
    );
    return new Date(valid.length > 0 ? Math.min(...valid) : wallMs - offsetBefore);
}

/** How far ahead of UTC `timeZone` is at the instant `ms`. */
function offsetMs(ms: number, timeZone: string): number {
    return -new TZDate(ms, timeZone).getTimezoneOffset() * 60_000;
}

/**
 * The window a scheduled run for `slot` looks at: `[max(now, slot) + 1h, slot + lookAheadHours]`.
 * A late run (catch-up) loses the part of the window that's already too close. `null` when nothing
 * is left, i.e. the start isn't before the end.
 */
export function scheduledWindow(slot: Date, lookAheadHours: number, now: Date): NagWindow | null {
    const start = Math.max(now.getTime(), slot.getTime()) + MIN_LEAD_MS;
    const end = slot.getTime() + lookAheadHours * HOUR_MS;
    return start < end ? { start: new Date(start), end: new Date(end) } : null;
}

/**
 * The window a manual run (Run now / Dry run) looks at: `[now + 1h, now + lookAheadHours]`. `null`
 * when empty, which is the case for a one-hour look-ahead.
 */
export function manualWindow(lookAheadHours: number, now: Date): NagWindow | null {
    return scheduledWindow(now, lookAheadHours, now);
}

/** Whether `slot` hasn't been claimed yet: there's no previous claim, or it's for an earlier slot. */
export function isSlotDue(lastScheduledFor: Date | null, slot: Date): boolean {
    return lastScheduledFor == null || lastScheduledFor.getTime() < slot.getTime();
}

const WEEKDAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];

/** The schedule in words, e.g. "Mondays at 12:00". */
export function describeSchedule({ weekday, hour }: RuleSchedule): string {
    return `${WEEKDAY_NAMES[weekday]}s at ${String(hour).padStart(2, "0")}:00`;
}
