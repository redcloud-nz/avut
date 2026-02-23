/*
 *  Copyright (c) 2025 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { SkillGroup as SkillGroupRecord } from "@prisma/client";

import {
    propertiesSchema,
    recordStatusSchema,
    tagsSchema,
    zodNanoId16,
} from "../validation";
import { nanoId16 } from "../id";

import { SkillPackageId } from "./skill-package";

export const SkillGroupId = {
    schema: zodNanoId16("SkillGroupId expected").brand<"SkillGroupId">(),

    create: () => SkillGroupId.schema.parse(nanoId16()),
} as const;

export type SkillGroupId = string & z.BRAND<"SkillGroupId">;

const skillGroupSchema = z.object({
    id: SkillGroupId.schema,
    skillPackageId: SkillPackageId.schema,
    parentGroupId: SkillGroupId.schema.nullable(),
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    tags: tagsSchema,
    properties: propertiesSchema,
    sequence: z.number().int().nonnegative(),
    status: recordStatusSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export const SkillGroup = {
    schema: skillGroupSchema,

    modifiableSchema: skillGroupSchema.pick({
        name: true,
        description: true,
        tags: true,
        properties: true,
    }),

    fromRecord: (record: SkillGroupRecord) =>
        skillGroupSchema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
            updatedAt: record.updatedAt.toISOString(),
        }),
};

export type SkillGroup = z.infer<typeof skillGroupSchema>;

export type ModifiableSkillGroup = z.infer<typeof SkillGroup.modifiableSchema>;
