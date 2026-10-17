/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { addDays, differenceInCalendarDays, format, isSameDay, startOfDay } from "date-fns";

import { TZDate } from "@date-fns/tz";

import { TIME_FORMAT_PATTERNS, type DisplayPreferences } from "@/lib/datetime";

/*
 * What a skill check session's `startsAt`/`endsAt` mean, all judged in the **org's** time zone
 * (`OrganizationSettings.general.timeZone`), never the viewer's:
 *
 * | Session            | `startsAt`                      | `endsAt`                              |
 * | ------------------ | ------------------------------- | ------------------------------------- |
 * | All day, 1 day     | local midnight on the day       | local midnight the next day           |
 * | All day, N days    | local midnight on the first day | local midnight N calendar days later  |
 * | Timed, with end    | start time                      | end time (may cross midnight)         |
 * | Timed, no end      | start time                      | `null` (or `== startsAt`, legacy rows) |
 *
 * Calendar-day arithmetic is `addDays` on a `TZDate`, never `+24h`: NZ's DST days are 23 and 25
 * hours long.
 */

/** Fifteen minutes in milliseconds. Every IANA offset is a multiple of it, so the test is zone-free. */
const QUARTER_HOUR_MS = 15 * 60_000;

/** The written date pattern a session's day renders in. Fixed, not the viewer's `dateFormat`, because the weekday matters for a session. */
export const SESSION_DATE_PATTERN = "EEE d MMM yyyy";

/** The most days an all-day session can run, in the picker. */
export const MAX_SESSION_DAYS = 14;

/** The form state's start time when the session it was built from has none (an all-day one). */
export const DEFAULT_SESSION_START_TIME = "09:00";

export type SessionTiming = { kind: "allDay"; days: number } | { kind: "timed"; end?: Date };

/**
 * The start/end picker's state. `date` and the times are wall-clock values in the org's zone.
 *
 * - `days` (1–14 in the picker) only matters when `allDay`.
 * - `startTime`/`endTime` only matter when not `allDay`. An `endTime` before `startTime` means the
 *   next day; one equal to `startTime` is invalid, so a timed session always lasts under 24h.
 */
export type SessionFormState = {
    date: string;
    allDay: boolean;
    days: number;
    startTime: string;
    endTime: string | null;
};

/** The two instants a session stores, as UTC ISO strings (always `…Z`). */
export type SessionInstants = { startsAt: string; endsAt: string | null };

type Instant = string | Date;

/** Is `date` exactly on a quarter hour (no stray minutes, seconds or milliseconds)? */
export function isQuarterHour(date: Instant): boolean {
    return new Date(date).getTime() % QUARTER_HOUR_MS === 0;
}

/** `date` rounded to the nearest quarter hour (ties round up). */
export function snapToQuarter(date: Instant): Date {
    return new Date(Math.round(new Date(date).getTime() / QUARTER_HOUR_MS) * QUARTER_HOUR_MS);
}

/**
 * Classify a session's stored instants, judged in the org's zone.
 *
 * All-day when both ends fall on local midnight and `endsAt > startsAt`; `days` counts calendar
 * days. Anything else is timed, with no `end` when `endsAt` is null or equal to `startsAt` (how
 * legacy rows store "no end").
 */
export function sessionTiming(
    startsAt: Instant,
    endsAt: Instant | null,
    orgZone: string,
): SessionTiming {
    const start = new TZDate(new Date(startsAt), orgZone);
    const end = endsAt == null ? null : new TZDate(new Date(endsAt), orgZone);

    if (end == null || end.getTime() === start.getTime()) return { kind: "timed" };

    if (end.getTime() > start.getTime() && isLocalMidnight(start) && isLocalMidnight(end)) {
        return { kind: "allDay", days: differenceInCalendarDays(end, start) };
    }
    return { kind: "timed", end: new Date(end.getTime()) };
}

/**
 * Render when a session runs, in the org's zone:
 *
 * - "Sat 2 Feb 2026 · all day"
 * - "Sat 7 – Sun 8 Feb 2026" (multi-day, all day)
 * - "Tue 4 Feb 2026 · 19:00 – 21:00" (timed, in the viewer's `timeFormat`)
 *
 * A timed session gets the org zone's abbreviation appended ("NZDT") when the viewer's zone
 * differs from it. An end on a later local day carries its own date.
 */
export function formatSessionWhen(
    startsAt: Instant,
    endsAt: Instant | null,
    { orgZone, prefs }: { orgZone: string; prefs: DisplayPreferences },
): string {
    const start = new TZDate(new Date(startsAt), orgZone);
    const timing = sessionTiming(startsAt, endsAt, orgZone);

    if (timing.kind === "allDay") {
        if (timing.days === 1) return `${format(start, SESSION_DATE_PATTERN)} · all day`;

        const last = addDays(start, timing.days - 1);
        const firstPattern =
            start.getFullYear() !== last.getFullYear()
                ? SESSION_DATE_PATTERN
                : start.getMonth() !== last.getMonth()
                  ? "EEE d MMM"
                  : "EEE d";
        return `${format(start, firstPattern)} – ${format(last, SESSION_DATE_PATTERN)}`;
    }

    const timePattern = TIME_FORMAT_PATTERNS[prefs.timeFormat];
    const showZone = orgZone !== prefs.timeZone;
    const startZone = showZone ? zoneAbbreviation(start, orgZone) : null;

    let text = `${format(start, SESSION_DATE_PATTERN)} · ${format(start, timePattern)}`;

    if (timing.end) {
        const end = new TZDate(timing.end, orgZone);
        const endZone = showZone ? zoneAbbreviation(end, orgZone) : null;

        // Across a DST change the two ends carry different abbreviations; label each.
        if (startZone && startZone !== endZone) text += ` ${startZone}`;

        const endPattern = isSameDay(start, end)
            ? timePattern
            : start.getFullYear() === end.getFullYear()
              ? `EEE d MMM ${timePattern}`
              : `${SESSION_DATE_PATTERN} ${timePattern}`;
        text += ` – ${format(end, endPattern)}`;
        if (endZone) text += ` ${endZone}`;
    } else if (startZone) {
        text += ` ${startZone}`;
    }
    return text;
}

/**
 * Turn the picker's state into the instants to store, built in the org's zone and returned as
 * UTC ISO strings.
 *
 * A wall-clock start inside a spring-forward gap (02:15 on NZ's last Sunday of September) moves
 * forward by the gap, as `Date` does: it's stored as 03:15 NZDT.
 *
 * In zones where DST starts at midnight (America/Santiago, Asia/Beirut), local midnight on that
 * day doesn't exist, so an all-day session starting or ending there is stored at 01:00 and reads
 * back as timed. NZ's change is at 02:00, so it isn't affected.
 *
 * @throws RangeError when a timed session's `endTime` equals its `startTime`, or an all-day
 *   session's `days` isn't a positive integer.
 */
export function sessionInstants(state: SessionFormState, orgZone: string): SessionInstants {
    const [year, month, day] = state.date.split("-").map(Number);

    if (state.allDay) {
        if (!Number.isInteger(state.days) || state.days < 1) {
            throw new RangeError(`An all-day session needs at least one day, got ${state.days}`);
        }
        const start = new TZDate(year, month - 1, day, orgZone);
        return { startsAt: toUtcIso(start), endsAt: toUtcIso(addDays(start, state.days)) };
    }

    const [startHour, startMinute] = state.startTime.split(":").map(Number);
    const start = new TZDate(year, month - 1, day, startHour, startMinute, orgZone);
    if (state.endTime == null) return { startsAt: toUtcIso(start), endsAt: null };

    if (state.endTime === state.startTime) {
        throw new RangeError("A timed session's end time can't equal its start time");
    }
    const [endHour, endMinute] = state.endTime.split(":").map(Number);
    // "HH:mm" strings order the same as the times they hold.
    const endDay = state.endTime < state.startTime ? day + 1 : day;
    const end = new TZDate(year, month - 1, endDay, endHour, endMinute, orgZone);
    return { startsAt: toUtcIso(start), endsAt: toUtcIso(end) };
}

/**
 * The picker's state for a stored session, in the org's zone. Snaps **both** ends to a quarter
 * hour first, so a legacy off-quarter time shows as the value that will be saved.
 *
 * A timed end that snaps onto the start reads as "no end". A timed session the picker can't hold
 * (24h or more, or an end at the start's time of day) comes back as an all-day one, both ends
 * snapped to the nearest local midnight. That's what an all-day session stored before the org's
 * zone changed looks like: midnight to midnight in the old zone, a whole number of days apart.
 * `days` is clamped to 1–`MAX_SESSION_DAYS`.
 */
export function sessionFormState(
    startsAt: Instant,
    endsAt: Instant | null,
    orgZone: string,
): SessionFormState {
    const snappedStart = snapToQuarter(startsAt);
    const snappedEnd = endsAt == null ? null : snapToQuarter(endsAt);
    const start = new TZDate(snappedStart, orgZone);
    const timing = sessionTiming(snappedStart, snappedEnd, orgZone);

    if (timing.kind === "allDay") {
        return allDayFormState(start, timing.days);
    }
    const end = timing.end && new TZDate(timing.end, orgZone);
    // Judged on the clock, as the picker offers it (an end on the start's day, or the next day
    // before the start's time), not in elapsed time: across the April fall-back, 04:00 to 03:45
    // the next day is 24h45 of real time but a session the picker made.
    const endDay = end ? differenceInCalendarDays(end, start) : 0;
    if (end && (endDay >= 2 || (endDay === 1 && format(end, "HH:mm") >= format(start, "HH:mm")))) {
        const firstDay = nearestLocalMidnight(start);
        return allDayFormState(
            firstDay,
            differenceInCalendarDays(nearestLocalMidnight(end), firstDay),
        );
    }
    return {
        date: format(start, "yyyy-MM-dd"),
        allDay: false,
        days: 1,
        startTime: format(start, "HH:mm"),
        endTime: end ? format(end, "HH:mm") : null,
    };
}

function allDayFormState(firstDay: TZDate, days: number): SessionFormState {
    return {
        date: format(firstDay, "yyyy-MM-dd"),
        allDay: true,
        days: Math.min(Math.max(days, 1), MAX_SESSION_DAYS),
        startTime: DEFAULT_SESSION_START_TIME,
        endTime: null,
    };
}

/** The local midnight nearest `date`: its own day's before noon, the next day's from noon on. */
function nearestLocalMidnight(date: TZDate): TZDate {
    const midnight = startOfDay(date);
    return date.getHours() >= 12 ? addDays(midnight, 1) : midnight;
}

function isLocalMidnight(date: TZDate): boolean {
    return (
        date.getHours() === 0 &&
        date.getMinutes() === 0 &&
        date.getSeconds() === 0 &&
        date.getMilliseconds() === 0
    );
}

/** UTC ISO string. `TZDate#toISOString()` writes the zone's offset, which `z.iso.datetime()` rejects. */
function toUtcIso(date: Date): string {
    return new Date(date.getTime()).toISOString();
}

/**
 * The zone's short name at `date` ("NZDT", or "GMT-4" where en-NZ has no abbreviation). Pinned
 * to `en-NZ` so the server render and the browser agree.
 */
export function zoneAbbreviation(date: Date, zone: string): string {
    return (
        new Intl.DateTimeFormat("en-NZ", { timeZone: zone, timeZoneName: "short" })
            .formatToParts(date)
            .find((part) => part.type === "timeZoneName")?.value ?? zone
    );
}
