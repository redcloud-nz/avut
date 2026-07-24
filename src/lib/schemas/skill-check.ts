/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { SkillCheck as SkillCheckRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

import { OrganizationId } from "./organization";
import { SkillCheckSessionId } from "./skill-check-session";
import { PersonId } from "./person";
import { SkillId } from "./skill";

export const SkillCheckId = {
    schema: zodNanoId16("SkillCheckId expected").brand<"SkillCheckId">(),

    create: () => SkillCheckId.schema.parse(nanoId16()),
} as const;

export type SkillCheckId = string & z.BRAND<"SkillCheckId">;

export const SkillCheck = {
    schema: z.object({
        id: SkillCheckId.schema,
        organizationId: OrganizationId.schema,
        sessionId: SkillCheckSessionId.schema.nullable(),
        assesseeId: PersonId.schema,
        assessorId: PersonId.schema,
        skillId: SkillId.schema,
        result: z.string(),
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

export const SKILL_CHECK_RESULT_LABELS: Record<string, string> = {
    NotAssessed: "Not Assessed",
    NotTaught: "Not Taught",
    NotYetCompetent: "Not Yet Competent",
    Competent: "Competent",
    HighlyConfident: "Highly Confident",
};

/**
 * The results that demonstrate competency. Any other result — including "Not Yet Competent" and
 * "Not Taught" — means the person is not competent in that skill.
 */
export const COMPETENT_SKILL_CHECK_RESULTS = ["Competent", "HighlyConfident"];

/**
 * Whether a skill check result demonstrates competency in the skill.
 * @param result The result of the skill check.
 */
export function isCompetentResult(result: string): boolean {
    return COMPETENT_SKILL_CHECK_RESULTS.includes(result);
}

export const SKILL_CHECK_STATUS_LABELS: Record<string, string> = {
    Draft: "Draft",
    Include: "Approved",
    Exclude: "Excluded",
};
