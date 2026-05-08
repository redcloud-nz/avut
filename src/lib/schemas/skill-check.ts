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
        name: z.string().max(100),
        result: z.string(),
        notes: z.string(),
        createdAt: z.iso.datetime(),
    }),

    fromRecord: (record: SkillCheckRecord) =>
        SkillCheck.schema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
        }),
} as const;

export type SkillCheck = z.infer<typeof SkillCheck.schema>;
