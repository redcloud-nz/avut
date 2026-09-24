/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import type { DiffChange } from "@/lib/diff";
import { UserSettings } from "@/lib/schemas/user-settings";
import { createMockPrisma } from "@/test/create-prisma-mock";

import { writeUserSettings } from "./user-settings-store";

describe("writeUserSettings", () => {
    it("records settings changes with segmented paths", async () => {
        const db = createMockPrisma();
        const userId = "user_1";

        await db.user.create({
            data: { id: userId, name: "Alex", email: "alex@example.com" },
        });

        const defaults = UserSettings.default();
        const next: UserSettings = {
            ...defaults,
            modules: {
                ...defaults.modules,
                profile: { ...defaults.modules.profile, enabled: false },
            },
        };

        let recorded: DiffChange[] = [];

        await writeUserSettings(db, userId, next, (changes) => {
            recorded = changes;
            return db.userConfig.findMany({ where: { userId } });
        });

        expect(recorded).toEqual([
            {
                type: "obj_mod",
                path: ["modules", "profile", "enabled"],
                prev: true,
                curr: false,
            },
        ]);
    });

    it("deletes a leaf's row when it is set back to its default", async () => {
        const db = createMockPrisma();
        const userId = "user_1";

        await db.user.create({
            data: { id: userId, name: "Alex", email: "alex@example.com" },
        });

        const defaults = UserSettings.default();
        const withProfile = (enabled: boolean): UserSettings => ({
            ...defaults,
            modules: { ...defaults.modules, profile: { ...defaults.modules.profile, enabled } },
        });

        await writeUserSettings(db, userId, withProfile(false));
        expect((await db.userConfig.findMany({ where: { userId } })).map((r) => r.key)).toEqual([
            "modules.profile.enabled",
        ]);

        const reverted = await writeUserSettings(db, userId, withProfile(true));

        expect(await db.userConfig.findMany({ where: { userId } })).toEqual([]);
        expect(reverted).toEqual(defaults);
    });

    it("leaves other materialised rows alone when one leaf reverts to its default", async () => {
        const db = createMockPrisma();
        const userId = "user_1";

        await db.user.create({
            data: { id: userId, name: "Alex", email: "alex@example.com" },
        });

        const defaults = UserSettings.default();
        const settings = (profile: boolean, dashboard: boolean): UserSettings => ({
            ...defaults,
            modules: {
                "user-dashboard": { ...defaults.modules["user-dashboard"], enabled: dashboard },
                profile: { ...defaults.modules.profile, enabled: profile },
            },
        });

        await writeUserSettings(db, userId, settings(false, false));
        await writeUserSettings(db, userId, settings(true, false));

        const records = await db.userConfig.findMany({ where: { userId } });
        expect(records.map((r) => r.key)).toEqual(["modules.user-dashboard.enabled"]);
        expect(UserSettings.fromRecords(records)).toEqual(settings(true, false));
    });
});
