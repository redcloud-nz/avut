/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

export const d4hActivityTypeSchema = z.enum(["Event", "Exercise", "Incident"]);
export const d4hTodayStatusSchema = z.enum(["attending", "absent", "requested", "not-involved"]);

export type D4HActivityType = z.infer<typeof d4hActivityTypeSchema>;

export type D4HAttendanceStatus = "ATTENDING" | "ABSENT" | "REQUESTED";

export type D4HTodayStatus = z.infer<typeof d4hTodayStatusSchema>;

/** A raw event / exercise / incident as fetched from D4H, reduced to what this view needs. */
export interface D4HTodayActivityInput {
    id: number;
    resourceType: D4HActivityType;
    reference: string | null;
    referenceDescription: string | null;
    startsAt: string;
    endsAt: string;
    location: string | null;
}

/** A raw attendance record for the current member. */
export interface D4HTodayAttendanceInput {
    activity: { id: number; resourceType: D4HActivityType };
    status: D4HAttendanceStatus;
}

export interface D4HTodayTeamInput {
    team: { id: number; title: string };
    /** IANA timezone of the team, used to render "today" in the team's own civil day. */
    timezone: string;
    activities: D4HTodayActivityInput[];
    attendances: D4HTodayAttendanceInput[];
}

export const d4hTodayActivitySchema = z.object({
    id: z.number(),
    type: d4hActivityTypeSchema,
    reference: z.string().nullable(),
    title: z.string(),
    startsAt: z.string(),
    endsAt: z.string(),
    location: z.string().nullable(),
    status: d4hTodayStatusSchema,
});

export const d4hTodayTeamGroupSchema = z.object({
    team: z.object({ id: z.number(), title: z.string() }),
    timezone: z.string(),
    activities: z.array(d4hTodayActivitySchema),
});

export type D4HTodayActivity = z.infer<typeof d4hTodayActivitySchema>;

export type D4HTodayTeamGroup = z.infer<typeof d4hTodayTeamGroupSchema>;

const STATUS_MAP: Record<D4HAttendanceStatus, Exclude<D4HTodayStatus, "not-involved">> = {
    ATTENDING: "attending",
    ABSENT: "absent",
    REQUESTED: "requested",
};

/**
 * Join the current member's attendance records onto today's activities, per team.
 *
 * Every event and exercise passed in is returned. Incidents are returned only when the
 * member has an attendance record for them. Activities are keyed by `(type, id)` since
 * ids are only unique within an activity type.
 */
export function buildD4HToday(teams: D4HTodayTeamInput[]): D4HTodayTeamGroup[] {
    return teams
        .map(({ team, timezone, activities, attendances }) => {
            const statusByKey = new Map(
                attendances.map((a) => [`${a.activity.resourceType}:${a.activity.id}`, a.status]),
            );

            const resolved = activities
                .map((raw): D4HTodayActivity => {
                    const status = statusByKey.get(`${raw.resourceType}:${raw.id}`);
                    return {
                        id: raw.id,
                        type: raw.resourceType,
                        reference: raw.reference,
                        title: raw.referenceDescription ?? raw.reference ?? "Untitled activity",
                        startsAt: raw.startsAt,
                        endsAt: raw.endsAt,
                        location: raw.location,
                        status: status ? STATUS_MAP[status] : "not-involved",
                    };
                })
                .filter((a) => a.type !== "Incident" || a.status !== "not-involved")
                .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id - b.id);

            return { team, timezone, activities: resolved };
        })
        .sort((a, b) => a.team.title.localeCompare(b.team.title));
}

/**
 * Given an instant and an IANA timezone, return the UTC instants that bound the
 * civil day (local midnight to local midnight) containing that instant in that zone.
 */
export function zonedTodayRange(now: Date, timeZone: string): { start: Date; end: Date } {
    const [year, month, day] = localYmd(now, timeZone);
    const start = zonedMidnightToUtc(year, month, day, timeZone);
    const end = zonedMidnightToUtc(year, month, day + 1, timeZone);
    return { start, end };
}

/** The [year, month (1-12), day] of `instant` as seen in `timeZone`. */
function localYmd(instant: Date, timeZone: string): [number, number, number] {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(instant);
    const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
    return [get("year"), get("month"), get("day")];
}

/**
 * The UTC instant whose wall-clock time in `timeZone` is the given local midnight.
 * `day` may be out of range (e.g. 32) — Date.UTC normalises it.
 */
function zonedMidnightToUtc(year: number, month: number, day: number, timeZone: string): Date {
    const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
    // Two iterations converge even across a DST boundary at midnight.
    const offset1 = tzOffsetMs(guess, timeZone);
    const offset2 = tzOffsetMs(guess - offset1, timeZone);
    return new Date(guess - offset2);
}

/** How far ahead of UTC `timeZone` is at the given instant, in milliseconds. */
function tzOffsetMs(utcMs: number, timeZone: string): number {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    }).formatToParts(new Date(utcMs));
    const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
    const asUtc = Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        get("hour"),
        get("minute"),
        get("second"),
    );
    return asUtc - utcMs;
}
