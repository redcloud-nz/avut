/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { SkillPackageSubscription as SkillPackageSubscriptionRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";
import { SkillPackageId } from "./skill-package";

export const SkillPackageSubscriptionId = {
    schema: zodNanoId16(
        "SkillPackageSubscriptionId expected",
    ).brand<"SkillPackageSubscriptionId">(),

    create: () => SkillPackageSubscriptionId.schema.parse(nanoId16()),
} as const;

export type SkillPackageSubscriptionId = string & z.BRAND<"SkillPackageSubscriptionId">;

const skillPackageSubscriptionSchema = z.object({
    id: SkillPackageSubscriptionId.schema,
    skillPackageId: SkillPackageId.schema,
    createdAt: z.iso.datetime().default(() => new Date().toISOString()),
    updatedAt: z.iso.datetime().default(() => new Date().toISOString()),
});

export const SkillPackageSubscription = {
    schema: skillPackageSubscriptionSchema,

    fromRecord: (record: SkillPackageSubscriptionRecord) =>
        skillPackageSubscriptionSchema.parse({
            ...record,
            createdAt: record?.createdAt?.toISOString(),
            updatedAt: record?.updatedAt?.toISOString(),
        }),
};

export type SkillPackageSubscription = z.infer<typeof skillPackageSubscriptionSchema>;
