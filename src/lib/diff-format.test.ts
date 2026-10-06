/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_DISPLAY_PREFERENCES, type DisplayPreferences } from "./datetime";
import {
    actionPastTenseLabel,
    describeChange,
    describeChanges,
    formatDiffValue,
    formatFieldPath,
    lowerFirst,
    objectTypeLabel,
    relatedActionPhrase,
    summariseChanges,
} from "./diff-format";

/** 2026-02-02 22:36 UTC — next morning (11:36 NZDT) in Auckland. */
const ISO = "2026-02-02T22:36:00.000Z";

/** The prefs most tests pass when the format itself isn't under test. */
const P = DEFAULT_DISPLAY_PREFERENCES;

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
        expect(formatDiffValue(null, P)).toBe("(empty)");
        expect(formatDiffValue("", P)).toBe("(empty)");
    });

    it("renders booleans as Yes/No", () => {
        expect(formatDiffValue(true, P)).toBe("Yes");
        expect(formatDiffValue(false, P)).toBe("No");
    });

    it("renders numbers", () => {
        expect(formatDiffValue(0, P)).toBe("0");
        expect(formatDiffValue(12.5, P)).toBe("12.5");
    });

    it("renders arrays as a comma list, formatting each item", () => {
        expect(formatDiffValue(["a", true, 3, null], P)).toBe("a, Yes, 3, (empty)");
        expect(formatDiffValue([], P)).toBe("(empty)");
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

    it("formats ISO datetimes without milliseconds or with an offset", () => {
        const utc = prefs({ timeZone: "UTC", dateFormat: "iso-extended", timeFormat: "24-hour" });
        // `formatISO`, as `DatePicker` emits it: no milliseconds, a local offset.
        expect(formatDiffValue("2026-02-03T11:36:00+13:00", utc)).toBe("2026-02-02 22:36");
        expect(formatDiffValue("2026-02-02T22:36:00Z", utc)).toBe("2026-02-02 22:36");
        expect(formatDiffValue("2026-02-02T12:36:00.000-10:00", utc)).toBe("2026-02-02 22:36");
    });

    it("leaves non-datetime strings alone, including date-like ones", () => {
        expect(formatDiffValue("Rescue 1", P)).toBe("Rescue 1");
        expect(formatDiffValue("2026-02-02", P)).toBe("2026-02-02");
        expect(formatDiffValue("2026-02-02T22:36:00.000Z and more", P)).toBe(
            "2026-02-02T22:36:00.000Z and more",
        );
        expect(formatDiffValue("2026-02-02T22:36:00", P)).toBe("2026-02-02T22:36:00");
        expect(formatDiffValue("2026-02-02T22:36:00+1300", P)).toBe("2026-02-02T22:36:00+1300");
        expect(formatDiffValue("123 Main St", P)).toBe("123 Main St");
    });
});

describe("describeChange", () => {
    it("obj_add → set", () => {
        expect(
            describeChange({ type: "obj_add", path: ["name"], curr: "Alice" }, { prefs: P }),
        ).toEqual({
            field: "Name",
            kind: "set",
            curr: "Alice",
        });
    });

    it("obj_add with an empty value → set (empty), since creates log empty fields as obj_add", () => {
        const setEmpty = { field: "Notes", kind: "set", curr: "(empty)" };
        expect(
            describeChange({ type: "obj_add", path: ["notes"], curr: null }, { prefs: P }),
        ).toEqual(setEmpty);
        expect(
            describeChange({ type: "obj_add", path: ["notes"], curr: "" }, { prefs: P }),
        ).toEqual(setEmpty);
        expect(
            describeChange({ type: "obj_add", path: ["notes"], curr: [] }, { prefs: P }),
        ).toEqual(setEmpty);
    });

    it("obj_del → cleared", () => {
        expect(
            describeChange({ type: "obj_del", path: ["email"], prev: "a@b.c" }, { prefs: P }),
        ).toEqual({
            field: "Email",
            kind: "cleared",
            prev: "a@b.c",
        });
    });

    it("obj_mod → changed", () => {
        expect(
            describeChange(
                { type: "obj_mod", path: ["isActive"], prev: true, curr: false },
                { prefs: P },
            ),
        ).toEqual({ field: "Is active", kind: "changed", prev: "Yes", curr: "No" });
    });

    it("obj_mask → masked", () => {
        expect(describeChange({ type: "obj_mask", path: ["password"] }, { prefs: P })).toEqual({
            field: "Password",
            kind: "masked",
        });
    });

    it("arr_add → added", () => {
        expect(
            describeChange({ type: "arr_add", path: ["tags"], value: "blue" }, { prefs: P }),
        ).toEqual({
            field: "Tags",
            kind: "added",
            curr: "blue",
        });
    });

    it("arr_del → removed", () => {
        expect(
            describeChange({ type: "arr_del", path: ["tags"], value: "red" }, { prefs: P }),
        ).toEqual({
            field: "Tags",
            kind: "removed",
            prev: "red",
        });
    });

    it("arr_ord → reordered", () => {
        expect(
            describeChange(
                {
                    type: "arr_ord",
                    path: ["order"],
                    prev: ["a", "b"],
                    curr: ["b", "a"],
                },
                { prefs: P },
            ),
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

    describe("valueLabel", () => {
        const names: Record<string, string> = { s1: "Knots", s2: "Radio" };
        const valueLabel = (value: unknown) =>
            typeof value === "string" ? (names[value] ?? "(unavailable)") : String(value);

        it("labels a scalar value in place of the default formatting", () => {
            expect(
                describeChange(
                    { type: "arr_add", path: ["skills"], value: "s1" },
                    { valueLabel, prefs: P },
                ),
            ).toEqual({ field: "Skills", kind: "added", curr: "Knots" });
            expect(
                describeChange(
                    { type: "arr_del", path: ["skills"], value: "gone" },
                    { valueLabel, prefs: P },
                ),
            ).toEqual({ field: "Skills", kind: "removed", prev: "(unavailable)" });
            // The default would render `true` as "Yes"; valueLabel replaces it entirely.
            expect(
                describeChange(
                    { type: "obj_mod", path: ["lead"], prev: "s2", curr: true },
                    { valueLabel, prefs: P },
                ),
            ).toEqual({ field: "Lead", kind: "changed", prev: "Radio", curr: "true" });
        });

        it("labels each element of an array value", () => {
            expect(
                describeChange(
                    { type: "obj_add", path: ["skills"], curr: ["s1", "s2", "gone"] },
                    { valueLabel, prefs: P },
                ),
            ).toEqual({ field: "Skills", kind: "set", curr: "Knots, Radio, (unavailable)" });
            expect(
                describeChange(
                    { type: "obj_add", path: ["skills"], curr: [] },
                    { valueLabel, prefs: P },
                ),
            ).toEqual({ field: "Skills", kind: "set", curr: "(empty)" });
        });
    });
});

describe("objectTypeLabel", () => {
    it("humanises a known type", () => {
        expect(objectTypeLabel("TeamMembership")).toBe("Team membership");
        expect(objectTypeLabel("SkillCheckSession")).toBe("Skill check session");
        expect(objectTypeLabel("OrganizationMembership")).toBe("Organisation membership");
        expect(objectTypeLabel("D4HAccessToken")).toBe("D4H access token");
    });

    it("uses an override where one exists", () => {
        expect(objectTypeLabel("Session")).toBe("Sign-in session");
    });

    it("humanises an unknown type the same way", () => {
        expect(objectTypeLabel("RetiredWidgetThing")).toBe("Retired widget thing");
        expect(objectTypeLabel("constructor")).toBe("Constructor");
    });
});

describe("actionPastTenseLabel", () => {
    it("puts a known action in the past tense", () => {
        expect(actionPastTenseLabel("Create")).toBe("Created");
        expect(actionPastTenseLabel("Update")).toBe("Updated");
        expect(actionPastTenseLabel("Unpublish")).toBe("Unpublished");
    });

    it("puts Reopen in the past tense", () => {
        expect(actionPastTenseLabel("Reopen")).toBe("Reopened");
    });

    it("returns an unknown action unchanged", () => {
        expect(actionPastTenseLabel("Frobnicate")).toBe("Frobnicate");
        expect(actionPastTenseLabel("constructor")).toBe("constructor");
    });
});

describe("relatedActionPhrase", () => {
    it("names a team membership change from the page's point of view", () => {
        expect(relatedActionPhrase("TeamMembership", "Team", "Create")).toBe("Added team member");
        expect(relatedActionPhrase("TeamMembership", "Person", "Create")).toBe("Added to team");
        expect(relatedActionPhrase("TeamMembership", "Team", "Delete")).toBe("Removed team member");
    });

    it("returns undefined when there is no phrase", () => {
        expect(relatedActionPhrase("TeamMembership", "Team", "Approve")).toBeUndefined();
        expect(relatedActionPhrase("OrganizationMembership", "Person", "Update")).toBeUndefined();
        expect(relatedActionPhrase("TeamMembership", "constructor", "Create")).toBeUndefined();
    });
});

describe("describeChanges", () => {
    it("merges array adds and removes per field, where the field first appears", () => {
        const lines = describeChanges(
            [
                { type: "obj_mod", path: ["name"], prev: "Old", curr: "New" },
                { type: "arr_add", path: ["skills"], value: "a" },
                { type: "arr_del", path: ["skills"], value: "x" },
                { type: "arr_add", path: ["skills"], value: "b" },
                { type: "arr_add", path: ["tags"], value: "red" },
                { type: "arr_add", path: ["skills"], value: "c" },
            ],
            () => ({ prefs: P }),
        );

        expect(lines).toEqual([
            { field: "Name", kind: "changed", prev: "Old", curr: "New" },
            { field: "Skills", kind: "added", curr: "a, b, c", count: 3 },
            { field: "Skills", kind: "removed", prev: "x" },
            { field: "Tags", kind: "added", curr: "red" },
        ]);
    });

    it("applies per-change options before merging", () => {
        const lines = describeChanges(
            [
                { type: "arr_add", path: ["skills"], value: "a" },
                { type: "arr_add", path: ["skills"], value: "b" },
                { type: "arr_add", path: ["tags"], value: "red" },
            ],
            (change) =>
                change.path[0] === "skills"
                    ? { prefs: P, valueLabel: (value) => `Skill ${String(value)}` }
                    : { prefs: P },
        );

        expect(lines).toEqual([
            { field: "Skills", kind: "added", curr: "Skill a, Skill b", count: 2 },
            { field: "Tags", kind: "added", curr: "red" },
        ]);
    });
});

describe("summariseChanges", () => {
    const add = (value: string) => ({ type: "arr_add" as const, path: ["skills"], value });
    const del = (value: string) => ({ type: "arr_del" as const, path: ["skills"], value });

    it("counts adds or removes on a single list", () => {
        expect(summariseChanges([add("a"), add("b"), add("c")])).toBe("Added 3 skills");
        expect(summariseChanges([del("a")])).toBe("Removed 1 skill");
    });

    it("says 'Updated' when one list both gained and lost values", () => {
        expect(summariseChanges([add("a"), del("b")])).toBe("Updated skills");
    });

    it("uses a label override for the noun", () => {
        expect(summariseChanges([add("a"), add("b")], { skills: "Competencies" })).toBe(
            "Added 2 competencies",
        );
    });

    it("returns undefined for anything but one list's adds and removes", () => {
        expect(summariseChanges([])).toBeUndefined();
        expect(
            summariseChanges([add("a"), { type: "arr_add", path: ["tags"], value: "red" }]),
        ).toBeUndefined();
        expect(
            summariseChanges([add("a"), { type: "obj_mod", path: ["name"], prev: "a", curr: "b" }]),
        ).toBeUndefined();
    });
});

describe("lowerFirst", () => {
    it("lower-cases a leading word but not a leading acronym", () => {
        expect(lowerFirst("Organisation membership")).toBe("organisation membership");
        expect(lowerFirst("D4H access token")).toBe("D4H access token");
        expect(lowerFirst("IDs")).toBe("IDs");
    });
});
