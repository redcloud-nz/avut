/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { Skill as SkillRecord } from "@prisma/client";

import {
    propertiesSchema,
    recordStatusSchema,
    tagsSchema,
    zodNanoId16,
} from "../validation";
import { nanoId16 } from "../id";

import { SkillPackageId } from "./skill-package";
import { SkillGroupId } from "./skill-group";

export const SkillId = {
    schema: zodNanoId16("SkillId expected").brand<"SkillId">(),

    create: () => SkillId.schema.parse(nanoId16()),
} as const;

export type SkillId = string & z.BRAND<"SkillId">;

const skillSchema = z.object({
    id: SkillId.schema,
    skillPackageId: SkillPackageId.schema,
    skillGroupId: SkillGroupId.schema.nullable(),
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    tags: tagsSchema,
    properties: propertiesSchema,
    sequence: z.number().int().nonnegative(),
    frequency: z.number().int().nonnegative(),
    defaultRequired: z.boolean(),
    status: recordStatusSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export const Skill = {
    schema: skillSchema,

    modifiableSchema: skillSchema.pick({
        skillGroupId: true,
        name: true,
        description: true,
        tags: true,
        properties: true,
        defaultRequired: true,
        frequency: true,
        status: true,
    }),

    fromRecord: (record: SkillRecord) =>
        skillSchema.parse({
            ...record,
            createdAt: record?.createdAt?.toISOString(),
            updatedAt: record?.updatedAt?.toISOString(),
        }),
};

export type Skill = z.infer<typeof skillSchema>;

export type ModifiableSkill = z.infer<typeof Skill.modifiableSchema>;
