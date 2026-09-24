/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";
import * as z from "zod";

import { createSettingsSchema, defineSettingsSlices } from "./settings-schema";
import { UserSettings } from "./user-settings";

describe("createSettingsSchema default skeleton", () => {
    it("materialises leaf defaults through arbitrarily nested plain objects", () => {
        const Settings = createSettingsSchema(
            z.object({
                a: z.object({
                    b: z.object({
                        c: z.object({ deep: z.string().default("here") }),
                    }),
                }),
                flat: z.boolean().default(true),
            }),
        );

        expect(Settings.default()).toEqual({ a: { b: { c: { deep: "here" } } }, flat: true });
    });

    it("leaves an object carrying its own default absent, so that default applies", () => {
        // The shape of `modules["skill-track"].results`: no per-leaf defaults, one default at the
        // object level. Recursing into it would supply `{}` and fail the inner required fields.
        const Settings = createSettingsSchema(
            z.object({
                group: z
                    .object({ required: z.string() })
                    .default({ required: "from-object-default" }),
            }),
        );

        expect(Settings.default()).toEqual({ group: { required: "from-object-default" } });
    });

    it("treats an array as a leaf when flattening", () => {
        const Settings = createSettingsSchema(
            z.object({ group: z.object({ tags: z.array(z.string()).default(["x", "y"]) }) }),
        );

        expect(Settings.flatten(Settings.default())).toEqual({ "group.tags": ["x", "y"] });
    });
});

describe("UserSettings", () => {
    it("resolves every leaf to its declared default", () => {
        expect(UserSettings.default()).toEqual({
            modules: {
                "user-dashboard": { enabled: true },
                profile: { enabled: true },
            },
            display: {
                dateFormat: "iso-extended",
                timeFormat: "24-hour",
                timeZone: "Pacific/Auckland",
            },
        });
    });

    it("round-trips through flatten/fromRecords", () => {
        const settings = UserSettings.default();
        settings.display.timeFormat = "12-hour";

        const records = Object.entries(UserSettings.flatten(settings)).map(([key, value]) => ({
            key,
            value,
        }));

        expect(UserSettings.fromRecords(records)).toEqual(settings);
    });

    it("falls back to defaults for every leaf not covered by a partial diff of changed keys", () => {
        // updateUserSettings only upserts UserConfig rows for keys that changed — fromRecords
        // must still reconstruct a fully-valid settings object from just those rows.
        const restored = UserSettings.fromRecords([{ key: "display.dateFormat", value: "slash" }]);

        expect(restored.display.dateFormat).toBe("slash");
        expect(restored.display.timeFormat).toBe("24-hour");
        expect(restored.modules.profile.enabled).toBe(true);
    });
});

describe("defineSettingsSlices", () => {
    const schema = z.object({
        group: z.object({
            enabled: z.boolean().default(false),
            mode: z.enum(["a", "b"]).default("b"),
        }),
        nested: z.object({
            inner: z.object({ flag: z.boolean().default(true) }),
        }),
    });
    const Slices = defineSettingsSlices(schema, ["group", "nested.inner"] as const);

    it("resolves a dot path to its split segments", () => {
        expect(Slices.pathOf("nested.inner")).toEqual(["nested", "inner"]);
    });

    it("leaves an omitted field absent rather than resolving it to its default", () => {
        // The bug this guards: `.partial()` alone still applies `.default()` to an omitted key,
        // so a card patching one field would carry defaults for the rest of its slice and reset
        // them. An omitted key must mean "leave alone".
        const parsed = Slices.input.parse({ slice: "group", patch: { mode: "a" } });
        if (parsed.slice !== "group") throw new Error("expected the group slice");

        expect(parsed.patch.mode).toBe("a");
        expect(parsed.patch.enabled).toBeUndefined();
    });

    it("rejects a patch field that does not belong to the named slice", () => {
        expect(() =>
            Slices.input.parse({ slice: "nested.inner", patch: { enabled: true } }),
        ).not.toThrow(); // unknown keys are stripped, not rejected
        expect(Slices.input.parse({ slice: "nested.inner", patch: { flag: false } }).patch).toEqual(
            { flag: false },
        );
    });

    it("rejects an unknown slice", () => {
        expect(() => Slices.input.parse({ slice: "nope", patch: {} })).toThrow();
    });

    it("rejects a patch field of the wrong type", () => {
        expect(() => Slices.input.parse({ slice: "group", patch: { enabled: 7 } })).toThrow();
    });
});
