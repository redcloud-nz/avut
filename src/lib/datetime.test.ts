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
    TIME_FORMAT_PATTERNS,
    type DisplayPreferences,
} from "./datetime";
import { UserSettings } from "./schemas/user-settings";

/*
 * Constructed from local-time components rather than an ISO string, so every expectation below
 * holds whatever zone the test process runs in. The formatters render in the runtime's zone —
 * which is itself a real problem for server-rendered dates, tracked separately.
 */
const INSTANT = new Date(2026, 8, 24, 14, 30);

/** An afternoon instant, so the 12-hour preset has to produce a "PM" to be distinguishable. */
function prefs(over: Partial<DisplayPreferences> = {}): DisplayPreferences {
    return { ...DEFAULT_DISPLAY_PREFERENCES, ...over };
}

describe("formatDate", () => {
    it.each([
        ["iso-basic", "20260924"],
        ["iso-extended", "2026-09-24"],
        ["iso-ordinal", "2026-267"],
        ["slash", "24/09/2026"],
        ["dot", "24.09.2026"],
        ["written", "24 Sep 2026"],
    ] as const)("renders the %s preset as %s", (dateFormat, expected) => {
        expect(formatDate(INSTANT, prefs({ dateFormat }))).toBe(expected);
    });

    it("covers every declared preset", () => {
        expect(Object.keys(DATE_FORMAT_PATTERNS).sort()).toEqual(
            ["iso-basic", "iso-extended", "iso-ordinal", "slash", "dot", "written"].sort(),
        );
    });

    it("accepts a date string as well as a Date", () => {
        expect(formatDate("2026-09-24T00:00:00", prefs())).toBe("2026-09-24");
    });
});

describe("formatDateTime", () => {
    it.each([
        ["24-hour", "2026-09-24 14:30"],
        ["12-hour", "2026-09-24 2:30 PM"],
    ] as const)("renders the %s preset as %s", (timeFormat, expected) => {
        expect(formatDateTime(INSTANT, prefs({ timeFormat }))).toBe(expected);
    });

    it("combines the date and time presets independently", () => {
        expect(formatDateTime(INSTANT, { dateFormat: "written", timeFormat: "12-hour" })).toBe(
            "24 Sep 2026 2:30 PM",
        );
    });

    it("covers every declared preset", () => {
        expect(Object.keys(TIME_FORMAT_PATTERNS).sort()).toEqual(["12-hour", "24-hour"]);
    });
});

describe("DEFAULT_DISPLAY_PREFERENCES", () => {
    /*
     * The point of deriving the fallback from the schema: if someone changes the declared
     * default of `display.dateFormat`, omitting `prefs` has to follow it rather than keep
     * rendering a stale hardcoded preset.
     */
    it("tracks the schema's own declared defaults", () => {
        expect(DEFAULT_DISPLAY_PREFERENCES).toEqual(UserSettings.default().display);
    });

    it("is what an omitted prefs argument renders", () => {
        expect(formatDate(INSTANT)).toBe(formatDate(INSTANT, DEFAULT_DISPLAY_PREFERENCES));
        expect(formatDateTime(INSTANT)).toBe(formatDateTime(INSTANT, DEFAULT_DISPLAY_PREFERENCES));
    });
});
