/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { userModules } from "@/lib/modules";

import { resolveModuleFlags, resolveUserModuleFlags } from "./module-flags";

// `resolveModuleFlags`/`resolveUserModuleFlags` are `cache()`d per request, but outside a request
// React's `cache` doesn't memoise, so each call re-evaluates the mocked flags.
const flags = vi.hoisted(() => ({ notes: true, i3: true }));

vi.mock("@/lib/flags", () => ({
    i3ModuleFlag: async () => flags.i3,
    notesModuleFlag: async () => flags.notes,
}));

describe("resolveUserModuleFlags", () => {
    beforeEach(() => {
        flags.notes = true;
        flags.i3 = true;
    });

    it("has an entry for every user module", async () => {
        const resolved = await resolveUserModuleFlags();

        expect(Object.keys(resolved).toSorted()).toEqual(userModules.map((m) => m.id).toSorted());
    });

    it("turns user-notes on with the notes-module flag", async () => {
        await expect(resolveUserModuleFlags()).resolves.toMatchObject({ "user-notes": true });
    });

    it("turns user-notes off with the notes-module flag, and leaves unflagged modules on", async () => {
        flags.notes = false;

        const resolved = await resolveUserModuleFlags();

        expect(resolved).toEqual({ "user-dashboard": true, "user-notes": false });
        // The org Notes module shares the flag.
        await expect(resolveModuleFlags()).resolves.toMatchObject({ notes: false });
    });
});
