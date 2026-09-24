/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import {
    DATE_FORMAT_PATTERNS,
    DEFAULT_DISPLAY_PREFERENCES,
    formatDate,
    formatDateTime,
    formatRelativeDateTime,
    TIME_FORMAT_PATTERNS,
    type DisplayPreferences,
} from "./datetime";
import { UserSettings } from "./schemas/user-settings";

/*
 * Every expectation below is written against a fixed *instant*, not against local date
 * components, and names the zone it expects that instant rendered in. That is the whole point:
 * an assertion built from `new Date(2026, 1, 2, ...)` passes under any process zone and so
 * proves nothing, which is what an earlier version of this file did.
 *
 * The suite runs under `TZ=America/New_York` (see `vitest.config.ts`) and `npm run test:tz`
 * re-runs it under `Asia/Kolkata` — neither of which is any zone asserted on here, and Kolkata's
 * +05:30 catches offset arithmetic that assumes whole hours. A formatter that quietly used the
 * process zone would have to disagree with one of the two runs.
 */

/** 2026-02-02 22:36 UTC — late evening in UTC, next morning in NZ. */
const INSTANT = new Date("2026-02-02T22:36:00.000Z");

/** 2026-04-04 13:30 UTC — 02:30 NZST, just after NZ's daylight-saving clocks go back. */
const DST_EDGE = new Date("2026-04-04T13:30:00.000Z");

function prefs(over: Partial<DisplayPreferences> = {}): DisplayPreferences {
    return { ...DEFAULT_DISPLAY_PREFERENCES, ...over };
}

describe("formatDate", () => {
    it.each([
        ["iso-basic", "20260203"],
        ["iso-extended", "2026-02-03"],
        ["iso-ordinal", "2026-034"],
        ["slash", "03/02/2026"],
        ["dot", "03.02.2026"],
        ["written", "03 Feb 2026"],
    ] as const)("renders the %s preset as %s in Pacific/Auckland", (dateFormat, expected) => {
        expect(formatDate(INSTANT, prefs({ dateFormat, timeZone: "Pacific/Auckland" }))).toBe(
            expected,
        );
    });

    it("covers every declared preset", () => {
        expect(Object.keys(DATE_FORMAT_PATTERNS).sort()).toEqual(
            ["dot", "iso-basic", "iso-extended", "iso-ordinal", "slash", "written"].sort(),
        );
    });
});

describe("time zone", () => {
    /*
     * The regression this whole mechanism exists for: one instant, two zones, two different
     * calendar days. Before `display.timeZone`, which of these you got depended on which
     * process did the rendering — the server said one and the browser said the other.
     */
    it("puts one instant on different days either side of the dateline", () => {
        expect(formatDate(INSTANT, prefs({ timeZone: "Pacific/Auckland" }))).toBe("2026-02-03");
        expect(formatDate(INSTANT, prefs({ timeZone: "UTC" }))).toBe("2026-02-02");
    });

    it.each([
        ["Pacific/Auckland", "2026-02-03 11:36"],
        ["UTC", "2026-02-02 22:36"],
        ["America/New_York", "2026-02-02 17:36"],
        ["Asia/Kolkata", "2026-02-03 04:06"],
    ] as const)("renders %s as %s", (timeZone, expected) => {
        expect(formatDateTime(INSTANT, prefs({ timeZone }))).toBe(expected);
    });

    it("takes the offset in force at that instant, not today's offset", () => {
        // NZ is +13 at INSTANT (daylight saving) and +12 at DST_EDGE, hours after the change.
        expect(formatDateTime(INSTANT, prefs({ timeZone: "Pacific/Auckland" }))).toBe(
            "2026-02-03 11:36",
        );
        expect(formatDateTime(DST_EDGE, prefs({ timeZone: "Pacific/Auckland" }))).toBe(
            "2026-04-05 02:30",
        );
    });

    it("handles a half-hour offset", () => {
        expect(formatDateTime(INSTANT, prefs({ timeZone: "Asia/Kolkata" }))).toBe(
            "2026-02-03 04:06",
        );
    });

    it("renders midnight as 00:xx rather than 24:xx", () => {
        // 2026-02-02T11:10Z is 00:10 the next day in Auckland (+13).
        expect(
            formatDateTime(
                new Date("2026-02-02T11:10:00.000Z"),
                prefs({ timeZone: "Pacific/Auckland" }),
            ),
        ).toBe("2026-02-03 00:10");
    });
});

describe("formatDateTime", () => {
    it.each([
        ["24-hour", "2026-02-03 11:36"],
        ["12-hour", "2026-02-03 11:36 AM"],
    ] as const)("renders the %s preset as %s", (timeFormat, expected) => {
        expect(formatDateTime(INSTANT, prefs({ timeFormat, timeZone: "Pacific/Auckland" }))).toBe(
            expected,
        );
    });

    it("combines the date, time and zone independently", () => {
        expect(
            formatDateTime(INSTANT, {
                dateFormat: "written",
                timeFormat: "12-hour",
                timeZone: "America/New_York",
            }),
        ).toBe("02 Feb 2026 5:36 PM");
    });

    it("covers every declared preset", () => {
        expect(Object.keys(TIME_FORMAT_PATTERNS).sort()).toEqual(["12-hour", "24-hour"]);
    });
});

describe("formatRelativeDateTime", () => {
    /*
     * Relative wording is a function of the elapsed interval, so it's the one rendering that was
     * never zone-dependent — and stays correct while the absolute line beside it is wrong. Worth
     * pinning, because it's the reason the two lines of a card can contradict each other.
     */
    it("is unaffected by the display zone", () => {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        expect(formatRelativeDateTime(threeDaysAgo)).toBe("3 days ago");
    });
});

describe("DEFAULT_DISPLAY_PREFERENCES", () => {
    it("tracks the schema's own declared defaults", () => {
        expect(DEFAULT_DISPLAY_PREFERENCES).toEqual(UserSettings.default().display);
    });

    it("names an explicit zone rather than deferring to the process", () => {
        expect(DEFAULT_DISPLAY_PREFERENCES.timeZone).toBe("Pacific/Auckland");
    });

    it("is what an omitted prefs argument renders", () => {
        expect(formatDate(INSTANT)).toBe(formatDate(INSTANT, DEFAULT_DISPLAY_PREFERENCES));
        expect(formatDateTime(INSTANT)).toBe(formatDateTime(INSTANT, DEFAULT_DISPLAY_PREFERENCES));
    });
});

describe("UserSettings.display.timeZone", () => {
    it("rejects a string that isn't an IANA zone", () => {
        const result = UserSettings.schema.shape.display.safeParse({
            ...UserSettings.default().display,
            timeZone: "Middle/Earth",
        });
        expect(result.success).toBe(false);
    });

    it("accepts a real zone", () => {
        const result = UserSettings.schema.shape.display.safeParse({
            ...UserSettings.default().display,
            timeZone: "Europe/London",
        });
        expect(result.success).toBe(true);
    });
});
