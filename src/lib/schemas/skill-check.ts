/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { SkillCheck as SkillCheckRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

import { OrganizationId } from "./organization";
import { OrganizationSettings } from "./organization-settings";
import {
    defaultSkillCheckResultLabel,
    SKILL_CHECK_RESULT_VALUES,
    SkillCheckResultValue,
} from "./skill-check-result";
import { SkillCheckSessionId } from "./skill-check-session";
import { PersonId } from "./person";
import { SkillId } from "./skill";

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
    SKILL_CHECK_RESULT_VALUES,
    SkillCheckResultValue,
} from "./skill-check-result";

export const SkillCheck = {
    schema: z.object({
        id: SkillCheckId.schema,
        organizationId: OrganizationId.schema,
        sessionId: SkillCheckSessionId.schema.nullable(),
        assesseeId: PersonId.schema,
        assessorId: PersonId.schema,
        skillId: SkillId.schema,
        result: SkillCheckResultValue.schema,
        notes: z.string(),
        status: z.enum(["Draft", "Include", "Exclude"]),
        createdAt: z.iso.datetime(),
    }),

    fromRecord: (record: SkillCheckRecord) =>
        SkillCheck.schema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
        }),
} as const;

export type SkillCheck = z.infer<typeof SkillCheck.schema>;

export const SKILL_CHECK_STATUS_LABELS: Record<string, string> = {
    Draft: "Draft",
    Include: "Approved",
    Exclude: "Excluded",
};

/**
 * The org's enabled result values, in fixed app-wide order, with their configured labels.
 */
export function getEnabledSkillCheckResultOptions(
    settings: OrganizationSettings,
): { value: SkillCheckResultValue; label: string }[] {
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
