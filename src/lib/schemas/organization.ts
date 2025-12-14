/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { Organization as OrganizationRecord } from "@prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

import { OrganizationSettings } from "./organization-settings";

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

export type OrganizationWithSettings = OrganizationData & {
    settings: OrganizationSettings;
};
