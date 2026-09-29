/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_DISPLAY_PREFERENCES, formatDateTime, type DisplayPreferences } from "./datetime";
import { describeChange, formatDiffValue, formatFieldPath, objectTypeLabel } from "./diff-format";

/** 2026-02-02 22:36 UTC — next morning (11:36 NZDT) in Auckland. */
const ISO = "2026-02-02T22:36:00.000Z";

function prefs(over: Partial<DisplayPreferences> = {}): DisplayPreferences {
    return { ...DEFAULT_DISPLAY_PREFERENCES, ...over };
}

describe("formatFieldPath", () => {
    it("humanises camelCase", () => {
        expect(formatFieldPath(["callSign"])).toBe("Call sign");
    });

    it("joins nested path segments", () => {
        expect(formatFieldPath(["properties", "callSign"])).toBe("Properties › Call sign");
    });

    it("keeps acronyms and applies word replacements", () => {
        expect(formatFieldPath(["d4hTeamId"])).toBe("D4H team ID");
        expect(formatFieldPath(["organizationId"])).toBe("Organisation ID");
        expect(formatFieldPath(["snake_case_field"])).toBe("Snake case field");
    });

    it("prefers a label override keyed by the joined path", () => {
        const labels = { "properties.callSign": "Radio call sign" };
        expect(formatFieldPath(["properties", "callSign"], labels)).toBe("Radio call sign");
        // Only an exact path match overrides.
        expect(formatFieldPath(["callSign"], labels)).toBe("Call sign");
    });

    it("ignores inherited keys on the label map", () => {
        expect(formatFieldPath(["constructor"], {})).toBe("Constructor");
    });
});

describe("formatDiffValue", () => {
    it("renders null and empty string as (empty)", () => {
        expect(formatDiffValue(null)).toBe("(empty)");
        expect(formatDiffValue("")).toBe("(empty)");
    });

    it("renders booleans as Yes/No", () => {
        expect(formatDiffValue(true)).toBe("Yes");
        expect(formatDiffValue(false)).toBe("No");
    });

    it("renders numbers", () => {
        expect(formatDiffValue(0)).toBe("0");
        expect(formatDiffValue(12.5)).toBe("12.5");
    });

    it("renders arrays as a comma list, formatting each item", () => {
        expect(formatDiffValue(["a", true, 3, null])).toBe("a, Yes, 3, (empty)");
        expect(formatDiffValue([])).toBe("(empty)");
    });

    it("formats an ISO datetime string with the default preferences", () => {
        expect(formatDiffValue(ISO)).toBe(formatDateTime(new Date(ISO)));
    });

    it("honours the viewer's preferences for an ISO datetime", () => {
        expect(
            formatDiffValue(
                ISO,
                prefs({ timeZone: "UTC", dateFormat: "iso-extended", timeFormat: "24-hour" }),
            ),
        ).toBe("2026-02-02 22:36");
        expect(
            formatDiffValue(
                ISO,
                prefs({
                    timeZone: "Pacific/Auckland",
                    dateFormat: "written",
                    timeFormat: "12-hour",
                }),
            ),
        ).toBe("03 Feb 2026 11:36 AM");
    });

    it("leaves non-datetime strings alone, including date-like ones", () => {
        expect(formatDiffValue("Rescue 1")).toBe("Rescue 1");
        expect(formatDiffValue("2026-02-02")).toBe("2026-02-02");
        expect(formatDiffValue("2026-02-02T22:36:00.000Z and more")).toBe(
            "2026-02-02T22:36:00.000Z and more",
        );
        expect(formatDiffValue("123 Main St")).toBe("123 Main St");
    });
});

describe("describeChange", () => {
    it("obj_add → set", () => {
        expect(describeChange({ type: "obj_add", path: ["name"], curr: "Alice" })).toEqual({
            field: "Name",
            kind: "set",
            curr: "Alice",
        });
    });

    it("obj_add with an empty value → cleared", () => {
        expect(describeChange({ type: "obj_add", path: ["name"], curr: null })).toEqual({
            field: "Name",
            kind: "cleared",
        });
        expect(describeChange({ type: "obj_add", path: ["name"], curr: "" }).kind).toBe("cleared");
        expect(describeChange({ type: "obj_add", path: ["tags"], curr: [] }).kind).toBe("cleared");
    });

    it("obj_del → cleared", () => {
        expect(describeChange({ type: "obj_del", path: ["email"], prev: "a@b.c" })).toEqual({
            field: "Email",
            kind: "cleared",
            prev: "a@b.c",
        });
    });

    it("obj_mod → changed", () => {
        expect(
            describeChange({ type: "obj_mod", path: ["isActive"], prev: true, curr: false }),
        ).toEqual({ field: "Is active", kind: "changed", prev: "Yes", curr: "No" });
    });

    it("obj_mask → masked", () => {
        expect(describeChange({ type: "obj_mask", path: ["password"] })).toEqual({
            field: "Password",
            kind: "masked",
        });
    });

    it("arr_add → added", () => {
        expect(describeChange({ type: "arr_add", path: ["tags"], value: "blue" })).toEqual({
            field: "Tags",
            kind: "added",
            curr: "blue",
        });
    });

    it("arr_del → removed", () => {
        expect(describeChange({ type: "arr_del", path: ["tags"], value: "red" })).toEqual({
            field: "Tags",
            kind: "removed",
            prev: "red",
        });
    });

    it("arr_ord → reordered", () => {
        expect(
            describeChange({
                type: "arr_ord",
                path: ["order"],
                prev: ["a", "b"],
                curr: ["b", "a"],
            }),
        ).toEqual({ field: "Order", kind: "reordered", prev: "a, b", curr: "b, a" });
    });

    it("passes labels and prefs through", () => {
        const result = describeChange(
            { type: "obj_mod", path: ["properties", "startedAt"], prev: null, curr: ISO },
            {
                labels: { "properties.startedAt": "Start" },
                prefs: prefs({
                    timeZone: "UTC",
                    dateFormat: "iso-extended",
                    timeFormat: "24-hour",
                }),
            },
        );
        expect(result).toEqual({
            field: "Start",
            kind: "changed",
            prev: "(empty)",
            curr: "2026-02-02 22:36",
        });
    });
});

describe("objectTypeLabel", () => {
    it("humanises a known type", () => {
        expect(objectTypeLabel("TeamMembership")).toBe("Team membership");
        expect(objectTypeLabel("SkillCheckSession")).toBe("Skill check session");
        expect(objectTypeLabel("OrganizationMembership")).toBe("Organisation membership");
    });

    it("uses an override where one exists", () => {
        expect(objectTypeLabel("D4HAccessToken")).toBe("D4H access token");
        expect(objectTypeLabel("Session")).toBe("Sign-in session");
    });

    it("humanises an unknown type the same way", () => {
        expect(objectTypeLabel("RetiredWidgetThing")).toBe("Retired widget thing");
        expect(objectTypeLabel("constructor")).toBe("Constructor");
    });
});
