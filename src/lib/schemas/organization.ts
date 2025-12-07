/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import {
    Organization as OrganizationRecord,
    OrganizationConfig as OrganizationConfigRecord,
} from "@prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

export const OrganizationId = {
    schema: zodNanoId16("OrganizationId expected").brand<"OrganizationId">(),

    create: (): OrganizationId => OrganizationId.schema.parse(nanoId16()),
} as const;

export type OrganizationId = string & z.BRAND<"OrganizationId">;

const organizationSchema = z.object({
    id: OrganizationId.schema,
    name: z.string().min(5).max(100),
    slug: z
        .string()
        .min(3)
        .max(50)
        .regex(/^[a-z0-9-_]+$/),
});

export const OrganizationData = {
    schema: organizationSchema,

    fromRecord: (record: OrganizationRecord): OrganizationData =>
        organizationSchema.parse({
            ...record,
        }),
};

export type OrganizationData = z.infer<typeof organizationSchema>;

const organizationSettingsSchema = z.object({
    "modules.d4h-views.enabled": z.boolean().default(false),
    "modules.notes.enabled": z.boolean().default(false),
    "modules.skills.enabled": z.boolean().default(false),
    "modules.skill-package-manager.enabled": z.boolean().default(false),
});

export const OrganizationSettings = {
    schema: organizationSettingsSchema,

    fromRecords(records: OrganizationConfigRecord[]): OrganizationSettings {
        const settingsObj: Record<string, unknown> = {};
        for (const record of records) {
            settingsObj[record.key] = record.value;
        }
        return organizationSettingsSchema.parse(settingsObj);
    },
};

export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;

export type OrganizationWithSettings = OrganizationData & {
    settings: OrganizationSettings;
};
