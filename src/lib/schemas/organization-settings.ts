/* eslint-disable @typescript-eslint/no-explicit-any */
/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as R from "remeda";
import * as z from "zod";

import { OrganizationConfig as OrganizationConfigRecord } from "@/generated/prisma/client";
import { D4HServerCode } from "@/lib/d4h-servers";
import { configurableModuleIds } from "@/lib/modules";

const organizationSettingsSchema = z.object({
    general: z.object({
        publicDomain: z.string().regex(z.regexes.domain, "Invalid domain format").optional(),
    }),

    integrations: z.object({
        d4h: z.object({
            enabled: z.boolean().default(false),
            defaultServer: D4HServerCode.schema.default("ap"),
            syncToken: z.string().nullable().default(null),
            teamSync: z.enum(["Never", "Daily", "Weekly"]).default("Never"),
            teamMemberSync: z.enum(["Never", "Daily", "Weekly"]).default("Never"),
        }),
        email: z.object({
            enabled: z.boolean().default(true),
        }),
    }),
    modules: z.object({
        "d4h-views": z.object({
            enabled: z.boolean().default(false),
        }),
        forms: z.object({
            enabled: z.boolean().default(false),
        }),
        i3: z.object({
            enabled: z.boolean().default(false),
            storage: z.enum(["AVUT", "D4H"]).default("D4H"),
        }),
        notes: z.object({
            enabled: z.boolean().default(false),
        }),
        "skill-track": z.object({
            enabled: z.boolean().default(false),
        }),
        "skill-package-builder": z.object({
            enabled: z.boolean().default(false),
        }),
    }),
});

export const OrganizationSettings = {
    schema: organizationSettingsSchema,

    integrationKeys: ["d4h", "email"],
    moduleKeys: configurableModuleIds,

    default(): OrganizationSettings {
        return organizationSettingsSchema.parse({
            general: {},
            integrations: {
                d4h: {},
                email: {},
            },
            modules: {
                "d4h-views": {},
                forms: {},
                i3: {},
                notes: {},
                "skill-track": {},
                "skill-package-builder": {},
            },
        });
    },

    flatten(settings: OrganizationSettings) {
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

    fromRecords(records: OrganizationConfigRecord[]): OrganizationSettings {
        const settings = {
            general: {},
            integrations: R.fromEntries(
                OrganizationSettings.integrationKeys.map((key) => [key, {}]),
            ),
            modules: R.fromEntries(OrganizationSettings.moduleKeys.map((key) => [key, {}])),
        } as any;

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

        return organizationSettingsSchema.parse(settings);
    },
} as const;

export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;
