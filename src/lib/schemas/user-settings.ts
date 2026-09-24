/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { UserConfig as UserConfigRecord } from "@/generated/prisma/client";

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

export const UserSettings = {
    schema: userSettingsSchema,

    default(): UserSettings {
        return userSettingsSchema.parse({
            modules: {
                "user-dashboard": {},
                profile: {},
            },
            display: {},
        });
    },

    flatten(settings: UserSettings) {
        const result: Record<string, any> = {};

        function recurse(obj: Record<string, any>, prefix: string) {
            for (const key in obj) {
                const value = obj[key];
                const newKey = prefix ? `${prefix}.${key}` : key;
                if (value && typeof value === "object" && !Array.isArray(value)) {
                    recurse(value as Record<string, any>, newKey);
                } else {
                    result[newKey] = value;
                }
            }
        }

        recurse(settings, "");
        return result;
    },

    fromRecords(records: UserConfigRecord[]): UserSettings {
        // Start from a fully-defaulted settings object rather than an empty skeleton — see
        // `OrganizationSettings.fromRecords` for why.
        const settings = structuredClone(UserSettings.default()) as any;

        for (const record of records) {
            const parts = record.key.split(".");
            let current = settings;

            for (let i = 0; i < parts.length - 1; i++) {
                if (current[parts[i]] == undefined) {
                    current[parts[i]] = {};
                }
                current = current[parts[i]];
            }

            const lastKey = parts[parts.length - 1];
            current[lastKey] = record.value;
        }

        return userSettingsSchema.parse(settings);
    },
} as const;

export type UserSettings = z.infer<typeof userSettingsSchema>;
