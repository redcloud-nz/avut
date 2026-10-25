/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";

import { OrganizationSettings, OrganizationSettingsSlices } from "./organization-settings";
import { SKILL_CHECK_RESULT_VALUES } from "./skill-check-result";

describe("OrganizationSettings default skill-track result config", () => {
    const ENABLED_BY_DEFAULT = new Set(["NotTaught", "Fail", "Pass", "StrongPass"]);

    it("enables exactly the default subset, with a readable label for every value", () => {
        const { results } = OrganizationSettings.default().modules["skill-track"];

        for (const value of SKILL_CHECK_RESULT_VALUES) {
            expect(results[value].enabled).toBe(ENABLED_BY_DEFAULT.has(value));
            expect(results[value].label.length).toBeGreaterThan(0);
        }

        expect(results.WeakPass.label).toBe("Weak Pass");
        expect(results.StrongPass.label).toBe("Strong Pass");
    });

    it("round-trips through flatten/fromRecords", () => {
        const settings = OrganizationSettings.default();
        settings.modules["skill-track"].results.LowFail = {
            enabled: true,
            label: "Marginal Fail",
        };

        const flattened = OrganizationSettings.flatten(settings);
        const organizationId = OrganizationId.create();
        const records = Object.entries(flattened).map(([key, value]) => ({
            organizationId,
            key,
            value,
        }));

        const restored = OrganizationSettings.fromRecords(records);
        expect(restored.modules["skill-track"].results.LowFail).toEqual({
            enabled: true,
            label: "Marginal Fail",
        });
        expect(restored.modules["skill-track"].results.NotTaught.enabled).toBe(true);
    });

    it("falls back to defaults for every leaf not covered by a partial diff of changed keys", () => {
        // updateOrganizationSettings only upserts OrganizationConfig rows for keys that changed —
        // fromRecords must still reconstruct a fully-valid settings object from just those rows,
        // not only from a complete flatten() of every leaf.
        const organizationId = OrganizationId.create();
        const records = [
            {
                organizationId,
                key: "modules.skill-track.results.WeakPass.enabled",
                value: true,
            },
        ];

        const restored = OrganizationSettings.fromRecords(records);
        expect(restored.modules["skill-track"].results.WeakPass.enabled).toBe(true);
        expect(restored.modules["skill-track"].results.NotTaught).toEqual({
            enabled: true,
            label: "Not Taught",
        });
        expect(restored.modules["skill-track"].results.Fail).toEqual({
            enabled: true,
            label: "Fail",
        });
    });
});

describe("OrganizationSettings general.timeZone", () => {
    it("defaults to Pacific/Auckland", () => {
        expect(OrganizationSettings.default().general.timeZone).toBe("Pacific/Auckland");
    });

    it("resolves the default for an org whose stored general rows predate the setting", () => {
        const restored = OrganizationSettings.fromRecords([
            { key: "general.publicDomain", value: "example.org" },
        ]);

        expect(restored.general).toEqual({
            publicDomain: "example.org",
            timeZone: "Pacific/Auckland",
        });
    });

    it("accepts a known zone in a general slice patch and rejects an unknown one", () => {
        const parsed = OrganizationSettingsSlices.input.parse({
            slice: "general",
            patch: { timeZone: "America/New_York" },
        });
        expect(parsed.patch).toEqual({ timeZone: "America/New_York" });

        expect(() =>
            OrganizationSettingsSlices.input.parse({
                slice: "general",
                patch: { timeZone: "Mars/Olympus_Mons" },
            }),
        ).toThrow("Unknown IANA time zone");
    });
});

describe("OrganizationSettings modules.d4h-i3", () => {
    it("defaults organisationRecordsOnly to false", () => {
        expect(OrganizationSettings.default().modules["d4h-i3"]).toEqual({
            enabled: false,
            storage: "D4H",
            organisationRecordsOnly: false,
            notify: { org: [], teams: {} },
        });
    });

    it("resolves the default for an org whose stored d4h-i3 rows predate the setting", () => {
        const restored = OrganizationSettings.fromRecords([
            { key: "modules.d4h-i3.enabled", value: true },
        ]);

        expect(restored.modules["d4h-i3"].organisationRecordsOnly).toBe(false);
        expect(restored.modules["d4h-i3"].notify).toEqual({ org: [], teams: {} });
    });
});

describe("OrganizationSettings modules.d4h-i3.notify", () => {
    const person1 = PersonId.create();
    const person2 = PersonId.create();
    const team1 = TeamId.create();
    const team2 = TeamId.create();

    it("flattens to one row for the org list and one per team, and round-trips", () => {
        const settings = OrganizationSettings.default();
        settings.modules["d4h-i3"].notify = {
            org: [person1],
            teams: { [team1]: [person1, person2], [team2]: [person2] },
        };

        const flattened = OrganizationSettings.flatten(settings);
        const notifyEntries = Object.entries(flattened).filter(([key]) =>
            key.startsWith("modules.d4h-i3.notify."),
        );
        expect(Object.fromEntries(notifyEntries)).toEqual({
            "modules.d4h-i3.notify.org": [person1],
            [`modules.d4h-i3.notify.teams.${team1}`]: [person1, person2],
            [`modules.d4h-i3.notify.teams.${team2}`]: [person2],
        });

        const restored = OrganizationSettings.fromRecords(
            notifyEntries.map(([key, value]) => ({ key, value })),
        );
        expect(restored.modules["d4h-i3"].notify).toEqual(settings.modules["d4h-i3"].notify);
    });

    it("rejects an entry that isn't a PersonId", () => {
        expect(() =>
            OrganizationSettings.fromRecords([
                { key: "modules.d4h-i3.notify.org", value: ["not a person id"] },
            ]),
        ).toThrow();
        expect(() =>
            OrganizationSettings.fromRecords([
                { key: `modules.d4h-i3.notify.teams.${team1}`, value: [42] },
            ]),
        ).toThrow();
    });

    it("rejects a key that isn't a TeamId", () => {
        expect(() =>
            OrganizationSettings.fromRecords([
                { key: "modules.d4h-i3.notify.teams.not-a-team", value: [person1] },
            ]),
        ).toThrow();
        expect(() =>
            OrganizationSettingsSlices.input.parse({
                slice: "modules.d4h-i3",
                patch: { notify: { org: [], teams: { "not-a-team": [person1] } } },
            }),
        ).toThrow();
    });

    it("must be patched whole, so a partial notify can't wipe the team lists", () => {
        expect(() =>
            OrganizationSettingsSlices.input.parse({
                slice: "modules.d4h-i3",
                patch: { notify: { org: [person1] } },
            }),
        ).toThrow();
        expect(() =>
            OrganizationSettingsSlices.input.parse({
                slice: "modules.d4h-i3",
                patch: { notify: { teams: { [team1]: [person1] } } },
            }),
        ).toThrow();
    });
});
