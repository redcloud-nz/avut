/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_DISPLAY_PREFERENCES, type DisplayPreferences } from "./datetime";
import {
    DEFAULT_SESSION_START_TIME,
    formatSessionWhen,
    isQuarterHour,
    MAX_SESSION_DAYS,
    sessionFormState,
    sessionInstants,
    sessionTiming,
    snapToQuarter,
    type SessionFormState,
} from "./session-timing";

/*
 * Every instant below is a literal UTC string with its Pacific/Auckland wall-clock reading
 * alongside. The suite runs under `TZ=America/New_York` (and `Asia/Kolkata` via `test:tz`), so
 * anything that leaked the process zone would disagree with these.
 *
 * NZ daylight saving in 2026: clocks go back 03:00 NZDT → 02:00 NZST on Sun 5 April, and forward
 * 02:00 NZST → 03:00 NZDT on Sun 27 September.
 */

const NZ = "Pacific/Auckland";

function prefs(over: Partial<DisplayPreferences> = {}): DisplayPreferences {
    return { ...DEFAULT_DISPLAY_PREFERENCES, timeZone: NZ, timeFormat: "24-hour", ...over };
}

/** Sat 7 Feb 2026 00:00 NZDT. */
const SAT_7_FEB = "2026-02-06T11:00:00.000Z";
/** Sun 8 Feb 2026 00:00 NZDT. */
const SUN_8_FEB = "2026-02-07T11:00:00.000Z";
/** Mon 9 Feb 2026 00:00 NZDT. */
const MON_9_FEB = "2026-02-08T11:00:00.000Z";
/** Tue 3 Feb 2026 19:00 NZDT. */
const TUE_3_FEB_1900 = "2026-02-03T06:00:00.000Z";
/** Tue 3 Feb 2026 21:00 NZDT. */
const TUE_3_FEB_2100 = "2026-02-03T08:00:00.000Z";
/** Fri 6 Feb 2026 22:00 NZDT. */
const FRI_6_FEB_2200 = "2026-02-06T09:00:00.000Z";
/** Sat 7 Feb 2026 01:00 NZDT. */
const SAT_7_FEB_0100 = "2026-02-06T12:00:00.000Z";

/** Sat 4 Apr 2026 00:00 NZDT. */
const SAT_4_APR = "2026-04-03T11:00:00.000Z";
/** Tue 7 Apr 2026 00:00 NZST — three calendar days later, 73 hours. */
const TUE_7_APR = "2026-04-06T12:00:00.000Z";
/** Sat 26 Sep 2026 00:00 NZST. */
const SAT_26_SEP = "2026-09-25T12:00:00.000Z";
/** Tue 29 Sep 2026 00:00 NZDT — three calendar days later, 71 hours. */
const TUE_29_SEP = "2026-09-28T11:00:00.000Z";

describe("isQuarterHour", () => {
    it.each([
        ["2026-02-03T06:00:00.000Z", true],
        ["2026-02-03T06:15:00.000Z", true],
        ["2026-02-03T06:45:00.000Z", true],
        ["2026-02-03T06:10:00.000Z", false],
        ["2026-02-03T06:15:01.000Z", false],
        ["2026-02-03T06:15:00.001Z", false],
    ])("%s → %s", (iso, expected) => {
        expect(isQuarterHour(iso)).toBe(expected);
        expect(isQuarterHour(new Date(iso))).toBe(expected);
    });
});

describe("snapToQuarter", () => {
    it("rounds 11:35:20.203 NZDT down to 11:30", () => {
        // 2026-03-10 11:35:20.203 NZDT
        expect(snapToQuarter("2026-03-09T22:35:20.203Z").toISOString()).toBe(
            "2026-03-09T22:30:00.000Z",
        );
    });

    it("rounds 17:55:31.162 NZDT up to 18:00", () => {
        // 2026-03-10 17:55:31.162 NZDT
        expect(snapToQuarter("2026-03-10T04:55:31.162Z").toISOString()).toBe(
            "2026-03-10T05:00:00.000Z",
        );
    });

    it("leaves a quarter hour alone", () => {
        expect(snapToQuarter(TUE_3_FEB_1900).toISOString()).toBe(TUE_3_FEB_1900);
    });
});

describe("sessionTiming", () => {
    it("all day, 1 day: midnight to the next midnight", () => {
        expect(sessionTiming(SAT_7_FEB, SUN_8_FEB, NZ)).toEqual({ kind: "allDay", days: 1 });
    });

    it("all day, N days: midnight to midnight N calendar days later", () => {
        expect(sessionTiming(SAT_7_FEB, MON_9_FEB, NZ)).toEqual({ kind: "allDay", days: 2 });
    });

    it("counts calendar days across the April DST change (a 25-hour day)", () => {
        expect(sessionTiming(SAT_4_APR, TUE_7_APR, NZ)).toEqual({ kind: "allDay", days: 3 });
    });

    it("counts calendar days across the September DST change (a 23-hour day)", () => {
        expect(sessionTiming(SAT_26_SEP, TUE_29_SEP, NZ)).toEqual({ kind: "allDay", days: 3 });
    });

    it("timed, with end", () => {
        expect(sessionTiming(TUE_3_FEB_1900, TUE_3_FEB_2100, NZ)).toEqual({
            kind: "timed",
            end: new Date(TUE_3_FEB_2100),
        });
    });

    it("timed, crossing midnight", () => {
        expect(sessionTiming(FRI_6_FEB_2200, SAT_7_FEB_0100, NZ)).toEqual({
            kind: "timed",
            end: new Date(SAT_7_FEB_0100),
        });
    });

    it("timed, no end: endsAt null", () => {
        expect(sessionTiming(TUE_3_FEB_1900, null, NZ)).toEqual({ kind: "timed" });
    });

    it("timed, no end: a legacy endsAt equal to startsAt", () => {
        expect(sessionTiming(TUE_3_FEB_1900, TUE_3_FEB_1900, NZ)).toEqual({ kind: "timed" });
    });

    it("a midnight session with no end is timed", () => {
        expect(sessionTiming(SAT_7_FEB, null, NZ)).toEqual({ kind: "timed" });
        expect(sessionTiming(SAT_7_FEB, SAT_7_FEB, NZ)).toEqual({ kind: "timed" });
    });

    it("judges midnight in the org's zone, not UTC or the process zone", () => {
        // Midnight to midnight in NZ is 11:00–11:00 UTC; in Sydney it's 02:00–02:00 local.
        expect(sessionTiming(SAT_7_FEB, SUN_8_FEB, "Australia/Sydney")).toEqual({
            kind: "timed",
            end: new Date(SUN_8_FEB),
        });
    });
});

describe("formatSessionWhen", () => {
    const org = { orgZone: NZ, prefs: prefs() };

    it("all day, 1 day", () => {
        expect(formatSessionWhen(SAT_7_FEB, SUN_8_FEB, org)).toBe("Sat 7 Feb 2026 · all day");
    });

    it("all day, N days in one month", () => {
        expect(formatSessionWhen(SAT_7_FEB, MON_9_FEB, org)).toBe("Sat 7 – Sun 8 Feb 2026");
    });

    it("all day across the April DST change", () => {
        expect(formatSessionWhen(SAT_4_APR, TUE_7_APR, org)).toBe("Sat 4 – Mon 6 Apr 2026");
    });

    it("all day across the September DST change", () => {
        expect(formatSessionWhen(SAT_26_SEP, TUE_29_SEP, org)).toBe("Sat 26 – Mon 28 Sep 2026");
    });

    it("all day across a month boundary", () => {
        // Sat 28 Feb 00:00 NZDT → Mon 2 Mar 00:00 NZDT
        expect(formatSessionWhen("2026-02-27T11:00:00.000Z", "2026-03-01T11:00:00.000Z", org)).toBe(
            "Sat 28 Feb – Sun 1 Mar 2026",
        );
    });

    it("all day across a year boundary", () => {
        // Thu 31 Dec 2026 00:00 NZDT → Sat 2 Jan 2027 00:00 NZDT
        expect(formatSessionWhen("2026-12-30T11:00:00.000Z", "2027-01-01T11:00:00.000Z", org)).toBe(
            "Thu 31 Dec 2026 – Fri 1 Jan 2027",
        );
    });

    it("an all-day session viewed from another zone still reads as all day, on the org's days", () => {
        const viewer = { orgZone: NZ, prefs: prefs({ timeZone: "America/New_York" }) };
        expect(formatSessionWhen(SAT_7_FEB, SUN_8_FEB, viewer)).toBe("Sat 7 Feb 2026 · all day");
        expect(formatSessionWhen(SAT_7_FEB, MON_9_FEB, viewer)).toBe("Sat 7 – Sun 8 Feb 2026");
    });

    it("timed, with end, in the viewer's 24-hour format", () => {
        expect(formatSessionWhen(TUE_3_FEB_1900, TUE_3_FEB_2100, org)).toBe(
            "Tue 3 Feb 2026 · 19:00 – 21:00",
        );
    });

    it("timed, with end, in the viewer's 12-hour format", () => {
        expect(
            formatSessionWhen(TUE_3_FEB_1900, TUE_3_FEB_2100, {
                orgZone: NZ,
                prefs: prefs({ timeFormat: "12-hour" }),
            }),
        ).toBe("Tue 3 Feb 2026 · 7:00 PM – 9:00 PM");
    });

    it("timed, crossing midnight, dates the end", () => {
        expect(formatSessionWhen(FRI_6_FEB_2200, SAT_7_FEB_0100, org)).toBe(
            "Fri 6 Feb 2026 · 22:00 – Sat 7 Feb 01:00",
        );
    });

    it("timed, no end (null or legacy endsAt === startsAt)", () => {
        expect(formatSessionWhen(TUE_3_FEB_1900, null, org)).toBe("Tue 3 Feb 2026 · 19:00");
        expect(formatSessionWhen(TUE_3_FEB_1900, TUE_3_FEB_1900, org)).toBe(
            "Tue 3 Feb 2026 · 19:00",
        );
    });

    it("ignores the viewer's dateFormat preference", () => {
        expect(
            formatSessionWhen(TUE_3_FEB_1900, null, {
                orgZone: NZ,
                prefs: prefs({ dateFormat: "iso-basic" }),
            }),
        ).toBe("Tue 3 Feb 2026 · 19:00");
    });

    describe("zone abbreviation", () => {
        const elsewhere = { orgZone: NZ, prefs: prefs({ timeZone: "America/New_York" }) };

        it("is left off when the viewer is in the org's zone", () => {
            expect(formatSessionWhen(TUE_3_FEB_1900, TUE_3_FEB_2100, org)).not.toMatch(/NZ/);
        });

        it("is appended, in the org's zone, when the viewer's zone differs", () => {
            expect(formatSessionWhen(TUE_3_FEB_1900, TUE_3_FEB_2100, elsewhere)).toBe(
                "Tue 3 Feb 2026 · 19:00 – 21:00 NZDT",
            );
            expect(formatSessionWhen(TUE_3_FEB_1900, null, elsewhere)).toBe(
                "Tue 3 Feb 2026 · 19:00 NZDT",
            );
        });

        it("reads NZST in winter", () => {
            // Tue 9 Jun 2026 19:00 NZST
            expect(formatSessionWhen("2026-06-09T07:00:00.000Z", null, elsewhere)).toBe(
                "Tue 9 Jun 2026 · 19:00 NZST",
            );
        });

        it("labels each end when a timed session spans a DST change", () => {
            // Sun 5 Apr 2026 01:00 NZDT → 04:00 NZST
            expect(
                formatSessionWhen(
                    "2026-04-04T12:00:00.000Z",
                    "2026-04-04T16:00:00.000Z",
                    elsewhere,
                ),
            ).toBe("Sun 5 Apr 2026 · 01:00 NZDT – 04:00 NZST");
        });

        it("is never added to an all-day session", () => {
            expect(formatSessionWhen(SAT_7_FEB, SUN_8_FEB, elsewhere)).toBe(
                "Sat 7 Feb 2026 · all day",
            );
        });
    });
});

describe("sessionInstants", () => {
    function state(over: Partial<SessionFormState>): SessionFormState {
        return {
            date: "2026-02-07",
            allDay: true,
            days: 1,
            startTime: "09:00",
            endTime: null,
            ...over,
        };
    }

    it("all day, 1 day", () => {
        expect(sessionInstants(state({}), NZ)).toEqual({ startsAt: SAT_7_FEB, endsAt: SUN_8_FEB });
    });

    it("all day, N days", () => {
        expect(sessionInstants(state({ days: 2 }), NZ)).toEqual({
            startsAt: SAT_7_FEB,
            endsAt: MON_9_FEB,
        });
    });

    it("all day across both NZ DST changes uses calendar days, not 24h", () => {
        expect(sessionInstants(state({ date: "2026-04-04", days: 3 }), NZ)).toEqual({
            startsAt: SAT_4_APR,
            endsAt: TUE_7_APR,
        });
        expect(sessionInstants(state({ date: "2026-09-26", days: 3 }), NZ)).toEqual({
            startsAt: SAT_26_SEP,
            endsAt: TUE_29_SEP,
        });
    });

    it("timed, with end", () => {
        expect(
            sessionInstants(
                state({ date: "2026-02-03", allDay: false, startTime: "19:00", endTime: "21:00" }),
                NZ,
            ),
        ).toEqual({ startsAt: TUE_3_FEB_1900, endsAt: TUE_3_FEB_2100 });
    });

    it("timed, an end before the start means the next day", () => {
        expect(
            sessionInstants(
                state({ date: "2026-02-06", allDay: false, startTime: "22:00", endTime: "01:00" }),
                NZ,
            ),
        ).toEqual({ startsAt: FRI_6_FEB_2200, endsAt: SAT_7_FEB_0100 });
    });

    it("timed, no end", () => {
        expect(
            sessionInstants(state({ date: "2026-02-03", allDay: false, startTime: "19:00" }), NZ),
        ).toEqual({ startsAt: TUE_3_FEB_1900, endsAt: null });
    });

    it("returns UTC strings ending in Z", () => {
        const { startsAt, endsAt } = sessionInstants(
            state({ date: "2026-02-03", allDay: false, startTime: "19:00", endTime: "21:00" }),
            NZ,
        );
        expect(startsAt).toMatch(/Z$/);
        expect(endsAt).toMatch(/Z$/);
    });

    it("rejects an end time equal to the start time", () => {
        expect(() =>
            sessionInstants(state({ allDay: false, startTime: "19:00", endTime: "19:00" }), NZ),
        ).toThrow(RangeError);
    });

    it("rejects an all-day session of zero days", () => {
        expect(() => sessionInstants(state({ days: 0 }), NZ)).toThrow(RangeError);
    });

    it("moves a start inside the spring-forward gap forward by the gap", () => {
        // 02:15 on Sun 27 Sep 2026 doesn't exist in NZ: clocks jump 02:00 NZST → 03:00 NZDT.
        const instants = sessionInstants(
            state({ date: "2026-09-27", allDay: false, startTime: "02:15" }),
            NZ,
        );
        // 03:15 NZDT
        expect(instants).toEqual({ startsAt: "2026-09-26T14:15:00.000Z", endsAt: null });
        expect(sessionFormState(instants.startsAt, instants.endsAt, NZ)).toMatchObject({
            date: "2026-09-27",
            startTime: "03:15",
        });
    });
});

describe("sessionFormState", () => {
    it("all day, 1 day", () => {
        expect(sessionFormState(SAT_7_FEB, SUN_8_FEB, NZ)).toEqual({
            date: "2026-02-07",
            allDay: true,
            days: 1,
            startTime: DEFAULT_SESSION_START_TIME,
            endTime: null,
        });
    });

    it("all day, N days across a DST change", () => {
        expect(sessionFormState(SAT_26_SEP, TUE_29_SEP, NZ)).toMatchObject({
            date: "2026-09-26",
            allDay: true,
            days: 3,
        });
    });

    it("timed, crossing midnight", () => {
        expect(sessionFormState(FRI_6_FEB_2200, SAT_7_FEB_0100, NZ)).toEqual({
            date: "2026-02-06",
            allDay: false,
            days: 1,
            startTime: "22:00",
            endTime: "01:00",
        });
    });

    it("timed, no end (null, or a legacy endsAt === startsAt)", () => {
        const expected = {
            date: "2026-02-03",
            allDay: false,
            days: 1,
            startTime: "19:00",
            endTime: null,
        };
        expect(sessionFormState(TUE_3_FEB_1900, null, NZ)).toEqual(expected);
        expect(sessionFormState(TUE_3_FEB_1900, TUE_3_FEB_1900, NZ)).toEqual(expected);
    });

    it("snaps both ends to a quarter hour", () => {
        // 11:35:20.203 → 11:30 and 17:55:31.162 → 18:00, Tue 10 Mar 2026 NZDT
        expect(
            sessionFormState("2026-03-09T22:35:20.203Z", "2026-03-10T04:55:31.162Z", NZ),
        ).toEqual({
            date: "2026-03-10",
            allDay: false,
            days: 1,
            startTime: "11:30",
            endTime: "18:00",
        });
    });

    it("snaps a legacy off-quarter session with endsAt === startsAt to one with no end", () => {
        const legacy = "2026-03-09T22:35:20.203Z";
        expect(sessionFormState(legacy, legacy, NZ)).toMatchObject({
            startTime: "11:30",
            endTime: null,
        });
    });

    it("reads the day in the org's zone, not the process zone", () => {
        // Tue 3 Feb 19:00 NZDT is still Tue 3 Feb 01:00 in New York, but Mon 2 Feb in Honolulu.
        expect(sessionFormState(TUE_3_FEB_1900, null, "Pacific/Honolulu")).toMatchObject({
            date: "2026-02-02",
            startTime: "20:00",
        });
    });

    describe("an all-day session stored before the org's zone changed", () => {
        const allDay = (date: string, days: number) => ({
            date,
            allDay: true,
            days,
            startTime: DEFAULT_SESSION_START_TIME,
            endTime: null,
        });

        it("reads back all day when the new zone is ahead", () => {
            // Sat 7 – Sun 8 Feb midnight in Sydney (AEDT) is 02:00 – 02:00 NZDT.
            expect(
                sessionFormState("2026-02-06T13:00:00.000Z", "2026-02-07T13:00:00.000Z", NZ),
            ).toEqual(allDay("2026-02-07", 1));
        });

        it("reads back all day when the new zone is behind", () => {
            // Sat 7 – Mon 9 Feb midnight NZDT is Fri 22:00 – Sun 22:00 in Sydney.
            expect(sessionFormState(SAT_7_FEB, MON_9_FEB, "Australia/Sydney")).toEqual(
                allDay("2026-02-07", 2),
            );
        });
    });

    it("reads a timed session of 24h or more as all day", () => {
        // Tue 3 Feb 19:00 – Wed 4 Feb 21:00 NZDT, 26 hours: Wed 4 Feb, the nearest midnights.
        expect(sessionFormState(TUE_3_FEB_1900, "2026-02-04T08:00:00.000Z", NZ)).toEqual({
            date: "2026-02-04",
            allDay: true,
            days: 1,
            startTime: DEFAULT_SESSION_START_TIME,
            endTime: null,
        });
    });

    it("reads a timed session ending at its start's time of day as all day, under 24h", () => {
        // Sat 26 Sep 09:00 NZST – Sun 27 Sep 09:00 NZDT is 23 hours, across the spring-forward.
        expect(
            sessionFormState("2026-09-25T21:00:00.000Z", "2026-09-26T20:00:00.000Z", NZ),
        ).toMatchObject({ date: "2026-09-26", allDay: true, days: 1, endTime: null });
    });

    it("clamps days to MAX_SESSION_DAYS", () => {
        // Sat 7 Feb – Mon 9 Mar midnight NZDT, 30 days.
        expect(sessionFormState(SAT_7_FEB, "2026-03-08T11:00:00.000Z", NZ)).toMatchObject({
            allDay: true,
            days: MAX_SESSION_DAYS,
        });
    });
});

describe("sessionInstants ∘ sessionFormState", () => {
    it.each([
        ["all day, 1 day", SAT_7_FEB, SUN_8_FEB],
        ["all day, N days", SAT_7_FEB, MON_9_FEB],
        ["all day across April DST", SAT_4_APR, TUE_7_APR],
        ["all day across September DST", SAT_26_SEP, TUE_29_SEP],
        ["timed, with end", TUE_3_FEB_1900, TUE_3_FEB_2100],
        ["timed, crossing midnight", FRI_6_FEB_2200, SAT_7_FEB_0100],
        ["timed, no end", TUE_3_FEB_1900, null],
    ])("round-trips %s", (_label, startsAt, endsAt) => {
        expect(sessionInstants(sessionFormState(startsAt, endsAt, NZ), NZ)).toEqual({
            startsAt,
            endsAt,
        });
    });

    it("normalises a legacy endsAt === startsAt to null", () => {
        expect(sessionInstants(sessionFormState(TUE_3_FEB_1900, TUE_3_FEB_1900, NZ), NZ)).toEqual({
            startsAt: TUE_3_FEB_1900,
            endsAt: null,
        });
    });
});
