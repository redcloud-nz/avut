/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { parseSessionDialog } from "./session-when-picker";

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
