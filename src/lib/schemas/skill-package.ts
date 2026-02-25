/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { SkillPackage as SkillPackageRecord } from "@prisma/client";

import { nanoId16 } from "../id";
import {
    propertiesSchema,
    recordStatusSchema,
    tagsSchema,
    zodNanoId16,
} from "../validation";

export const SkillPackageId = {
    schema: zodNanoId16("SkillPackageId expected").brand<"SkillPackageId">(),

    create: () => SkillPackageId.schema.parse(nanoId16()),
} as const;

export type SkillPackageId = string & z.BRAND<"SkillPackageId">;

const skillPackageSchema = z.object({
    id: SkillPackageId.schema,
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    tags: tagsSchema,
    properties: propertiesSchema,
    status: recordStatusSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export const SkillPackage = {
    schema: skillPackageSchema,

    modifiableSchema: skillPackageSchema.pick({
        name: true,
        description: true,
        tags: true,
        properties: true,
        status: true,
    }),

    fromRecord: (record: SkillPackageRecord) =>
        skillPackageSchema.parse({
            ...record,
            createdAt: record?.createdAt?.toISOString(),
            updatedAt: record?.updatedAt?.toISOString(),
        }),
};

export type SkillPackage = z.infer<typeof skillPackageSchema>;

export type ModifiableSkillPackage = z.infer<
    typeof SkillPackage.modifiableSchema
>;
