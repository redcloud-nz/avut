/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { createSettingsSchema, defineSettingsSlices } from "./settings-schema";

/**
 * Whether the runtime recognises `value` as an IANA zone. Asking `Intl` rather than
 * checking against a baked-in list, so the check tracks whatever zone database the runtime
 * ships with instead of going stale.
 */
function isValidTimeZone(value: string): boolean {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: value });
        return true;
    } catch {
        return false;
    }
}

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
        /*
         * The IANA zone every absolute timestamp is rendered in.
         *
         * Not cosmetic. Without it the formatters render in whatever zone the *process* is in,
         * so a Server Component renders a timestamp in the deployment's zone (UTC) while the
         * browser hydrates it in the viewer's — which at NZ's +12/+13 puts the two on different
         * calendar days, and the SSR'd HTML is simply wrong rather than merely inconsistent.
         * Pinning a zone here makes the two agree by construction.
         *
         * Defaults to the zone the organisations using this actually operate in, rather than
         * UTC, which would be wrong for every one of them.
         */
        timeZone: z
            .string()
            .refine(isValidTimeZone, "Unknown IANA time zone")
            .default("Pacific/Auckland"),
    }),
});

/**
 * The per-user settings tree, plus the `default`/`flatten`/`fromRecords` helpers every settings
 * scope shares — see `createSettingsSchema`.
 */
export const UserSettings = createSettingsSchema(userSettingsSchema);

export type UserSettings = z.infer<typeof userSettingsSchema>;

/**
 * The editable groups of the user settings tree — one per settings card. `modules` is a single
 * slice because one dialog edits every user module together, where the organization tree has a
 * card (and so a slice) per module.
 */
export const UserSettingsSlices = defineSettingsSlices(userSettingsSchema, [
    "modules",
    "display",
] as const);

export type UserSettingsSliceId = (typeof UserSettingsSlices.ids)[number];
