/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import type { ModuleFlagState } from "@/lib/module-flags";
import type { OrganizationModuleId } from "@/lib/modules";
import { OrganizationData, OrganizationId } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

import { OrganizationClient } from "./use-organization";

const ALL_ON: ModuleFlagState = {
    admin: true,
    "d4h-views": true,
    forms: true,
    i3: true,
    notes: true,
    "skill-track": true,
    "skill-package-builder": true,
};

function makeClient(opts: {
    moduleFlags?: Partial<ModuleFlagState>;
    enabled?: Partial<Record<OrganizationModuleId, boolean>>;
}) {
    const organization = OrganizationData.schema.parse({
        id: OrganizationId.create(),
        name: "Test Organization",
        slug: "test-org",
        createdAt: new Date().toISOString(),
        logo: null,
    });

    const settings = OrganizationSettings.default();
    for (const [id, value] of Object.entries(opts.enabled ?? {})) {
        (settings.modules as Record<string, { enabled: boolean }>)[id].enabled = value;
    }

    return new OrganizationClient(organization, settings, [], { ...ALL_ON, ...opts.moduleFlags });
}

describe("OrganizationClient.isModuleEnabled", () => {
    it("requires both the flag and the org setting for a flag-gated module", () => {
        expect(makeClient({}).isModuleEnabled("i3")).toBe(false); // setting defaults off

        expect(makeClient({ enabled: { i3: true } }).isModuleEnabled("i3")).toBe(true);

        expect(
            makeClient({ moduleFlags: { i3: false }, enabled: { i3: true } }).isModuleEnabled("i3"),
        ).toBe(false);

        expect(makeClient({ moduleFlags: { i3: false } }).isModuleEnabled("i3")).toBe(false);
    });

    it("treats a module without a flag as governed by its setting alone", () => {
        expect(
            makeClient({ enabled: { "skill-track": true } }).isModuleEnabled("skill-track"),
        ).toBe(true);
        expect(makeClient({}).isModuleEnabled("skill-track")).toBe(false);
    });

    it("keeps always-on admin enabled regardless of settings", () => {
        expect(makeClient({}).isModuleEnabled("admin")).toBe(true);
    });

    it("blocks even always-on admin when its flag is off", () => {
        expect(makeClient({ moduleFlags: { admin: false } }).isModuleEnabled("admin")).toBe(false);
    });
});
