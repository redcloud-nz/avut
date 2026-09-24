/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { D4HServerCode } from "@/lib/d4h-servers";

import { createSettingsSchema, defineSettingsSlices } from "./settings-schema";
import {
    defaultSkillCheckResultLabel,
    SKILL_CHECK_RESULT_VALUES,
    SkillCheckResultValue,
} from "./skill-check-result";

const SKILL_TRACK_DEFAULT_ENABLED_RESULTS: readonly SkillCheckResultValue[] = [
    "NotTaught",
    "Fail",
    "Pass",
    "StrongPass",
];

const skillCheckResultConfigSchema = z.object({
    enabled: z.boolean(),
    label: z.string().min(1),
});

const DEFAULT_SKILL_TRACK_RESULTS_CONFIG = Object.fromEntries(
    SKILL_CHECK_RESULT_VALUES.map((value) => [
        value,
        {
            enabled: SKILL_TRACK_DEFAULT_ENABLED_RESULTS.includes(value),
            label: defaultSkillCheckResultLabel(value),
        },
    ]),
) as Record<SkillCheckResultValue, { enabled: boolean; label: string }>;

const skillCheckResultsConfigSchema = z
    .object({
        NotTaught: skillCheckResultConfigSchema,
        LowFail: skillCheckResultConfigSchema,
        Fail: skillCheckResultConfigSchema,
        HighFail: skillCheckResultConfigSchema,
        WeakPass: skillCheckResultConfigSchema,
        Pass: skillCheckResultConfigSchema,
        StrongPass: skillCheckResultConfigSchema,
        Exempt: skillCheckResultConfigSchema,
        Expired: skillCheckResultConfigSchema,
        Provisional: skillCheckResultConfigSchema,
    })
    .default(DEFAULT_SKILL_TRACK_RESULTS_CONFIG);

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
    /*
     * Personnel lives under the always-on `org-admin` module rather than a gated one, so these are
     * top-level rather than a `modules.*` key.
     *
     * Both default to `false`: an organization that upgrades into this feature keeps doing
     * exactly what it did before until someone opts in. See `docs/specs/person-user-linking.md`.
     */
    personnel: z.object({
        /** Link a person on invitation accept when the org already has one with that email. */
        autoLinkOnInviteAccept: z.boolean().default(false),
        /** Link a newly-created person to an existing *member* holding the same email. */
        autoLinkOnPersonCreate: z.boolean().default(false),
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
            results: skillCheckResultsConfigSchema,
        }),
        "skill-package-builder": z.object({
            enabled: z.boolean().default(false),
        }),
    }),
});

/**
 * The per-organization settings tree, plus the `default`/`flatten`/`fromRecords` helpers every
 * settings scope shares — see `createSettingsSchema`.
 */
export const OrganizationSettings = createSettingsSchema(organizationSettingsSchema);

export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;

/**
 * The editable groups of the organization settings tree — one per settings card. See
 * `defineSettingsSlices` for why cards save a slice patch rather than the whole tree.
 */
export const OrganizationSettingsSlices = defineSettingsSlices(organizationSettingsSchema, [
    "general",
    "integrations.d4h",
    "integrations.email",
    "personnel",
    "modules.d4h-views",
    "modules.forms",
    "modules.i3",
    "modules.notes",
    "modules.skill-track",
    "modules.skill-package-builder",
] as const);

export type OrganizationSettingsSliceId = (typeof OrganizationSettingsSlices.ids)[number];
