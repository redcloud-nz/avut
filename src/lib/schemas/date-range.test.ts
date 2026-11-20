/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_DISPLAY_PREFERENCES, type DisplayPreferences } from "../datetime";

import { formatDateRange, formatPlainDate } from "./date-range";

/*
 * The suite runs under `TZ=America/New_York` (west of UTC), where reading `2026-02-03` as an
 * instant (UTC midnight) lands on 2 February. The display zone is set east of UTC too, so a
 * formatter that shifted by either zone would disagree with the day named.
 */
function prefs(over: Partial<DisplayPreferences> = {}): DisplayPreferences {
    return {
        ...DEFAULT_DISPLAY_PREFERENCES,
        dateFormat: "iso-extended",
        timeZone: "Pacific/Auckland",
        ...over,
    };
}

describe("formatPlainDate", () => {
    it("renders the named day, not the day of its UTC midnight", () => {
        expect(formatPlainDate("2026-02-03", prefs())).toBe("2026-02-03");
        expect(formatPlainDate("2026-02-03", prefs({ timeZone: "America/Los_Angeles" }))).toBe(
            "2026-02-03",
        );
    });

    it("uses the viewer's date format", () => {
        expect(formatPlainDate("2026-02-03", prefs({ dateFormat: "written" }))).toBe("03 Feb 2026");
    });
});

describe("formatDateRange", () => {
    it("renders both ends", () => {
        expect(formatDateRange({ from: "2026-02-03", to: "2026-02-10" }, prefs())).toBe(
            "2026-02-03 to 2026-02-10",
        );
    });

    it("reads a range with only a start as from that day", () => {
        expect(formatDateRange({ from: "2026-02-03" }, prefs())).toBe("from 2026-02-03");
    });

    it("reads a range with only an end as until that day", () => {
        expect(formatDateRange({ to: "2026-02-10" }, prefs())).toBe("until 2026-02-10");
    });

    it("reads an empty range as any date", () => {
        expect(formatDateRange({}, prefs())).toBe("any date");
    });
});
