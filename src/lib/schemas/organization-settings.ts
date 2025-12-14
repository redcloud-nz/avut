/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { OrganizationConfig as OrganizationConfigRecord } from "@prisma/client";

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
