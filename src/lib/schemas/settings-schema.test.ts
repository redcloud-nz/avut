/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";
import * as z from "zod";

import { createSettingsSchema } from "./settings-schema";
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
            display: { dateFormat: "iso-extended", timeFormat: "24-hour" },
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
