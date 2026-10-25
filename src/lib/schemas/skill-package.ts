/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import type { Prisma, SkillPackage as SkillPackageRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { propertiesSchema, recordStatusSchema, tagsSchema, zodNanoId16 } from "../validation";

export type { SkillPackageRecord };

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
    status: recordStatusSchema.default("Active"),
    published: z.boolean().default(false),
    createdAt: z.iso.datetime().default(() => new Date().toISOString()),
    updatedAt: z.iso.datetime().default(() => new Date().toISOString()),
});

export const SkillPackage = {
    schema: skillPackageSchema,

    /**
     * Whether a package is _available_: `published` and `Active`. Only an available package's
     * skills can be assessed or reported on, by every organization, the author's own included;
     * unpublishing or archiving withdraws them from subscribers. The server-side counterpart is
     * `availableSkillPackageWhere`.
     */
    isAvailable: (pkg: Pick<SkillPackage, "published" | "status">): boolean =>
        pkg.published && pkg.status === "Active",

    modifiableSchema: skillPackageSchema.pick({
        name: true,
        description: true,
        tags: true,
        properties: true,
    }),

    fromRecord: (record: SkillPackageRecord) =>
        skillPackageSchema.parse({
            ...record,
            createdAt: record?.createdAt?.toISOString(),
            updatedAt: record?.updatedAt?.toISOString(),
        }),
};

export type SkillPackage = z.infer<typeof skillPackageSchema>;

/**
 * Prisma `where` matching an _available_ package: `published` and `Active`. Only an available
 * package's skills can be assessed or reported on, by every organization, the author's own
 * included; every subscriber read filters its packages with this. The client-side counterpart is
 * `SkillPackage.isAvailable`.
 */
export const availableSkillPackageWhere = {
    published: true,
    status: "Active",
} satisfies Prisma.SkillPackageWhereInput;

export type ModifiableSkillPackage = z.infer<typeof SkillPackage.modifiableSchema>;

export const SkillPackageRef = {
    schema: z.object({
        id: SkillPackageId.schema,
        name: z.string().min(1).max(100),
    }),
} as const;

export type SkillPackageRef = z.infer<typeof SkillPackageRef.schema>;
