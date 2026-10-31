/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { D4HServerCode } from "@/lib/d4h-servers";

import { PersonId } from "./person";
import { createSettingsSchema, defineSettingsSlices } from "./settings-schema";
import {
    defaultSkillCheckResultLabel,
    SKILL_CHECK_RESULT_VALUES,
    SkillCheckResultValue,
} from "./skill-check-result";
import { TeamId } from "./team";
import { TimeZone } from "./time-zone";

const SKILL_TRACK_DEFAULT_ENABLED_RESULTS: readonly SkillCheckResultValue[] = [
    "NotTaught",
    "Fail",
    "Pass",
    "StrongPass",
];

/**
 * The results an organisation can switch on and relabel. Exempt, Expired, and Provisional exist in
 * the fixed vocabulary but aren't offered to organizations yet — their semantics aren't settled.
 * Remove from this list to enable them.
 */
export const SKILL_TRACK_CONFIGURABLE_RESULT_VALUES = SKILL_CHECK_RESULT_VALUES.filter(
    (value) => value !== "Exempt" && value !== "Expired" && value !== "Provisional",
);

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

export const RUBBISH_BIN_DEFAULT_RETENTION_DAYS = 30;
export const RUBBISH_BIN_MAX_RETENTION_DAYS = 90;

const organizationSettingsSchema = z.object({
    general: z.object({
        publicDomain: z.string().regex(z.regexes.domain, "Invalid domain format").optional(),
        /*
         * The IANA zone the organisation operates in. Skill check session start and end times
         * are defined against it: an all-day session runs from local midnight to local midnight
         * in this zone. Changing it doesn't re-anchor sessions already stored.
         */
        timeZone: TimeZone.schema.default("Pacific/Auckland"),
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
     * exactly what it did before until someone opts in. See `docs/specs/2026-09-14-person-user-linking.md`.
     */
    personnel: z.object({
        /** Link a person on invitation accept when the org already has one with that email. */
        autoLinkOnInviteAccept: z.boolean().default(false),
        /** Link a newly-created person to an existing *member* holding the same email. */
        autoLinkOnPersonCreate: z.boolean().default(false),
    }),
    /*
     * How long a Deleted record stays in the org's Rubbish bin before the daily purge removes it
     * for good (#298). One number for every entity type the org owns. This is routine deletion of
     * the org's own records, so the window is the org's call — the privacy policy's deletion
     * promises cover an organisation leaving AVUT and account closure, which use the fixed 14-day
     * system window instead.
     */
    rubbishBin: z.object({
        retentionDays: z
            .number()
            .int()
            .min(1)
            .max(RUBBISH_BIN_MAX_RETENTION_DAYS)
            .default(RUBBISH_BIN_DEFAULT_RETENTION_DAYS),
    }),
    modules: z.object({
        d4h: z.object({
            enabled: z.boolean().default(false),
        }),
        forms: z.object({
            enabled: z.boolean().default(false),
        }),
        "d4h-i3": z.object({
            enabled: z.boolean().default(false),
            storage: z.enum(["AVUT", "D4H"]).default("D4H"),
            /**
             * Limit the template and variant pickers to D4H records owned by the org's linked D4H
             * organisation. It doesn't change issuing, which still checks each item against the
             * recipient's team.
             */
            organisationRecordsOnly: z.boolean().default(false),
            /**
             * Who gets emailed when items are issued or returned (one list for both). A
             * submission's recipients are the union of `org` and the lists in `teams` of every
             * non-Deleted AVUT team linked (through `Team_D4H.d4hTeamId`) to the recipient's D4H
             * team, kept to Active people in the org with an email and deduped by id.
             *
             * `teams` is keyed by AVUT `TeamId`, not the D4H team id. It is a record rather than
             * an array of `{ teamId, personIds }` because `flatten` recurses into plain objects:
             * each team becomes its own config row (`modules.d4h-i3.notify.teams.<teamId>`)
             * holding an array of scalars, which is the only array shape `diffObject` accepts,
             * and the audit log then records changes per team. The settings store deletes the
             * row of a team that drops out of the next settings.
             */
            notify: z.object({
                org: z.array(PersonId.schema).default([]),
                teams: z.record(TeamId.schema, z.array(PersonId.schema)).default({}),
            }),
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
    "rubbishBin",
    "modules.d4h",
    "modules.forms",
    "modules.d4h-i3",
    "modules.notes",
    "modules.skill-track",
    "modules.skill-package-builder",
] as const);

export type OrganizationSettingsSliceId = (typeof OrganizationSettingsSlices.ids)[number];
