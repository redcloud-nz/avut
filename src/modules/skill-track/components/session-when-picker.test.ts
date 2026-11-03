/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { parseSessionDialog, sessionWhenSchema, withSessionEndTime } from "./session-when-picker";

const NZ = "Pacific/Auckland";

/** A timed session on `date` from `startTime` to `endTime`, as the dialogs hold it. */
function dialogValues(date: string, startTime: string, endTime: string | null) {
    return {
        name: "Session",
        notes: "",
        when: { date, allDay: false, days: 1, startTime, endTime },
    };
}

describe("parseSessionDialog", () => {
    it("returns what the API takes", () => {
        // Tue 3 Feb 2026 19:00 – 21:00 NZDT.
        expect(parseSessionDialog(dialogValues("2026-02-03", "19:00", "21:00"), NZ)).toEqual({
            success: true,
            data: {
                name: "Session",
                notes: "",
                startsAt: "2026-02-03T06:00:00.000Z",
                endsAt: "2026-02-03T08:00:00.000Z",
            },
        });
    });

    it("returns a timed session over several days", () => {
        // Tue 3 Feb 2026 19:00 – Wed 4 Feb 19:00 NZDT: an end at the start's time is fine here.
        const values = dialogValues("2026-02-03", "19:00", "19:00");
        expect(
            parseSessionDialog({ ...values, when: { ...values.when, days: 2 } }, NZ),
        ).toMatchObject({
            success: true,
            data: { startsAt: "2026-02-03T06:00:00.000Z", endsAt: "2026-02-04T06:00:00.000Z" },
        });
    });

    // NZ clocks go forward 02:00 NZST → 03:00 NZDT on Sun 27 Sep 2026, so 02:15 is stored as 03:15.
    it.each([
        ["before", "03:00"],
        ["onto", "03:15"],
    ])("refuses a start in the spring-forward gap that moves %s its end", (_label, endTime) => {
        const result = parseSessionDialog(dialogValues("2026-09-27", "02:15", endTime), NZ);

        expect(result.success).toBe(false);
        expect(!result.success && result.message).toMatch(/clocks go forward/);
    });

    it("accepts a start in the gap whose end is still after it", () => {
        expect(parseSessionDialog(dialogValues("2026-09-27", "02:15", "04:00"), NZ)).toMatchObject({
            success: true,
            data: { startsAt: "2026-09-26T14:15:00.000Z", endsAt: "2026-09-26T15:00:00.000Z" },
        });
    });
});

describe("sessionWhenSchema", () => {
    const timed = { date: "2026-02-03", allDay: false, startTime: "19:00" };

    it("refuses a one-day session ending at its start time", () => {
        expect(sessionWhenSchema.safeParse({ ...timed, days: 1, endTime: "19:00" }).success).toBe(
            false,
        );
    });

    it("accepts a session over several days ending at its start time", () => {
        expect(sessionWhenSchema.safeParse({ ...timed, days: 2, endTime: "19:00" }).success).toBe(
            true,
        );
    });

    it("refuses a one-day timed session with no end time", () => {
        expect(sessionWhenSchema.safeParse({ ...timed, days: 1, endTime: null }).success).toBe(
            false,
        );
    });

    it("refuses a timed session over several days with no end time", () => {
        expect(sessionWhenSchema.safeParse({ ...timed, days: 2, endTime: null }).success).toBe(
            false,
        );
    });
});

describe("withSessionEndTime", () => {
    const base = { date: "2026-02-03", days: 1, startTime: "19:00" };

    it("gives a timed session with no end one 2h after its start", () => {
        expect(withSessionEndTime({ ...base, allDay: false, endTime: null }).endTime).toBe("21:00");
    });

    it("leaves an end time, and an all-day session, alone", () => {
        const timed = { ...base, allDay: false, endTime: "20:00" };
        const allDay = { ...base, allDay: true, endTime: null };
        expect(withSessionEndTime(timed)).toBe(timed);
        expect(withSessionEndTime(allDay)).toBe(allDay);
    });
});
