/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { formatISO } from "date-fns";
import * as z from "zod";

import { SkillCheckSession as SkillCheckSessionRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

import { OrganizationId } from "./organization";

export const SkillCheckSessionId = {
    schema: zodNanoId16("SkillCheckSessionId expected").brand<"SkillCheckSessionId">(),

    create: () => SkillCheckSessionId.schema.parse(nanoId16()),
} as const;

export type SkillCheckSessionId = string & z.BRAND<"SkillCheckSessionId">;

const skillCheckSessionSchema = z.object({
    id: SkillCheckSessionId.schema,
    organizationId: OrganizationId.schema,
    name: z.string().max(100),
    date: z.iso.datetime(),
    notes: z.string(),
    status: z.enum(["Draft", "Include", "Exclude"]),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export const SkillCheckSession = {
    schema: skillCheckSessionSchema,

    modifiableSchema: skillCheckSessionSchema.pick({
        name: true,
        date: true,
        notes: true,
        status: true,
    }),

    fromRecord: (record: SkillCheckSessionRecord) =>
        SkillCheckSession.schema.parse({
            ...record,
            date: record.startsAt!.toISOString(),
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        }),
} as const;

export type SkillCheckSession = z.infer<typeof skillCheckSessionSchema>;

export type ModifiableSkillCheckSession = z.infer<typeof SkillCheckSession.modifiableSchema>;
