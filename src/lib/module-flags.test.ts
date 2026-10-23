/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { isModuleUsable, type ModuleFlagState } from "@/lib/module-flags";
import type { OrganizationModuleId } from "@/lib/modules";

const ALL_ON: ModuleFlagState = {
    "org-admin": true,
    d4h: true,
    forms: true,
    "d4h-i3": true,
    notes: true,
    "skill-track": true,
    "skill-package-builder": true,
};

const enabled =
    (...ids: OrganizationModuleId[]) =>
    (id: OrganizationModuleId) =>
        ids.includes(id);

describe("isModuleUsable", () => {
    it("follows the org setting for a module with no requirement", () => {
        expect(isModuleUsable(ALL_ON, "notes", enabled("notes"))).toBe(true);
        expect(isModuleUsable(ALL_ON, "notes", enabled())).toBe(false);
    });

    it("blocks a module whose Vercel flag is off", () => {
        expect(isModuleUsable({ ...ALL_ON, notes: false }, "notes", enabled("notes"))).toBe(false);
    });

    it("keeps always-on org-admin usable without a setting", () => {
        expect(isModuleUsable(ALL_ON, "org-admin", enabled())).toBe(true);
    });

    it("keeps D4H I3 unusable while D4H is off, even with D4H I3 enabled", () => {
        expect(isModuleUsable(ALL_ON, "d4h-i3", enabled("d4h-i3"))).toBe(false);
    });

    it("lets D4H I3 follow its own setting and flag once D4H is on", () => {
        expect(isModuleUsable(ALL_ON, "d4h-i3", enabled("d4h", "d4h-i3"))).toBe(true);
        expect(isModuleUsable(ALL_ON, "d4h-i3", enabled("d4h"))).toBe(false);
        expect(
            isModuleUsable({ ...ALL_ON, "d4h-i3": false }, "d4h-i3", enabled("d4h", "d4h-i3")),
        ).toBe(false);
    });

    it("doesn't make D4H depend on D4H I3", () => {
        expect(isModuleUsable(ALL_ON, "d4h", enabled("d4h"))).toBe(true);
    });
});
