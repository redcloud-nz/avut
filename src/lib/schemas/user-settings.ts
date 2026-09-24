/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { createSettingsSchema } from "./settings-schema";

const userSettingsSchema = z.object({
    /**
     * Per-user module preferences, mirroring `OrganizationSettings.modules` — keyed by
     * `UserModuleId` rather than `OrganizationModuleId`. Every user module is currently
     * `alwaysOn` (see `src/lib/modules.ts`), so nothing reads `enabled` to gate access yet;
     * this exists so a module can grow per-user options later without a schema migration,
     * per issue #93.
     */
    modules: z.object({
        "user-dashboard": z.object({
            enabled: z.boolean().default(true),
        }),
        profile: z.object({
            enabled: z.boolean().default(true),
        }),
    }),

    /**
     * Preferences that change what the user sees, rather than what's available to them (compare
     * `modules` above). `dateFormat`/`timeFormat` name a preset from `DATE_FORMAT_PATTERNS`/
     * `TIME_FORMAT_PATTERNS` (`src/lib/datetime.ts`) rather than storing a raw date-fns pattern,
     * so the set of choices stays curated. Not wired into `formatDate`/`formatDateTime` yet — see
     * those functions' docstrings.
     */
    display: z.object({
        dateFormat: z
            .enum(["iso-basic", "iso-extended", "iso-ordinal", "slash", "dot", "written"])
            .default("iso-extended"),
        timeFormat: z.enum(["12-hour", "24-hour"]).default("24-hour"),
    }),
});

/**
 * The per-user settings tree, plus the `default`/`flatten`/`fromRecords` helpers every settings
 * scope shares — see `createSettingsSchema`.
 */
export const UserSettings = createSettingsSchema(userSettingsSchema);

export type UserSettings = z.infer<typeof userSettingsSchema>;
