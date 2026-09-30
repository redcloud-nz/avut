/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { SkillCheck as SkillCheckRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

import { OrganizationId } from "./organization";
import { OrganizationSettings } from "./organization-settings";
import { PersonId } from "./person";
import { SkillId } from "./skill";
import {
    defaultSkillCheckResultLabel,
    SKILL_CHECK_RESULT_VALUES,
    SkillCheckResultValue,
} from "./skill-check-result";
import { SkillCheckSessionId } from "./skill-check-session";

export const SkillCheckId = {
    schema: zodNanoId16("SkillCheckId expected").brand<"SkillCheckId">(),

    create: () => SkillCheckId.schema.parse(nanoId16()),
} as const;

export type SkillCheckId = string & z.BRAND<"SkillCheckId">;

export {
    COMPETENT_SKILL_CHECK_RESULTS,
    DEFAULT_SKILL_CHECK_RESULT_LABELS,
    defaultSkillCheckResultLabel,
    isCompetentResult,
    SKILL_CHECK_FAIL_TIERS,
    SKILL_CHECK_PASS_TIERS,
    SKILL_CHECK_RESULT_VALUES,
    SkillCheckResultValue,
} from "./skill-check-result";

export const SkillCheck = {
    schema: z.object({
        id: SkillCheckId.schema,
        organizationId: OrganizationId.schema,
        sessionId: SkillCheckSessionId.schema.nullable(),
        assesseeId: PersonId.schema,
        /** Null once the assessor was purged from the Rubbish bin — see `assessorLabel`. */
        assessorId: PersonId.schema.nullable(),
        /** The purged assessor's name; only set when `assessorId` is null. */
        assessorLabel: z.string().nullable(),
        skillId: SkillId.schema,
        result: SkillCheckResultValue.schema,
        notes: z.string(),
        status: z.enum(["Draft", "Pending", "Include", "Exclude", "Deleted"]),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
    }),

    fromRecord: (record: SkillCheckRecord) =>
        SkillCheck.schema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        }),
} as const;

export type SkillCheck = z.infer<typeof SkillCheck.schema>;

/**
 * A session's check as `skillCheckSessions.listSessionChecks` returns it: the check with the
 * names of its assessee, skill and assessor, so it describes itself even once they are no longer
 * assigned to the session. `assessorName` falls back as `assessorDisplayName` does.
 */
export const SessionCheck = {
    schema: SkillCheck.schema.extend({
        assesseeName: z.string(),
        skillName: z.string(),
        assessorName: z.string(),
    }),
} as const;

export type SessionCheck = z.infer<typeof SessionCheck.schema>;

/**
 * How far `listSessionChecks`' cursor lags the server's clock, in milliseconds. A check stamped
 * this long before a read began is assumed to have committed by then (commit delay plus clock
 * skew between server instances stay under it).
 */
export const SESSION_CHECKS_LOOKBACK_MS = 10_000;

/**
 * Display name for a check's assessor: the live person, else the name kept when they were
 * purged from the Rubbish bin.
 */
export function assessorDisplayName(check: {
    assessor: { name: string } | null;
    assessorLabel: string | null;
}): string {
    return check.assessor?.name ?? check.assessorLabel ?? "Deleted person";
}

export const SKILL_CHECK_STATUS_LABELS: Record<string, string> = {
    Draft: "Draft",
    Pending: "Pending review",
    Include: "Approved",
    Exclude: "Excluded",
    Deleted: "Deleted",
};

/** One selectable result value with the org's label for it. */
export type SkillCheckResultOption = { value: SkillCheckResultValue; label: string };

/**
 * The org's enabled result values, in fixed app-wide order, with their configured labels.
 */
export function getEnabledSkillCheckResultOptions(
    settings: OrganizationSettings,
): SkillCheckResultOption[] {
    const results = settings.modules["skill-track"].results;
    return SKILL_CHECK_RESULT_VALUES.filter((value) => results[value].enabled).map((value) => ({
        value,
        label: results[value].label,
    }));
}

/**
 * The org-configured label for a result value, falling back to the default readable name.
 */
export function getSkillCheckResultLabel(
    settings: OrganizationSettings,
    value: SkillCheckResultValue,
): string {
    return (
        settings.modules["skill-track"].results[value]?.label ?? defaultSkillCheckResultLabel(value)
    );
}
