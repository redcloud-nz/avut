/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { z } from "zod";

import { Organization as OrganizationRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

import { OrganizationSettings } from "./organization-settings";

export const OrganizationId = {
    schema: zodNanoId16("OrganizationId expected").brand<"OrganizationId">(),

    create: () => OrganizationId.schema.parse(nanoId16()),
} as const;

export type OrganizationId = z.infer<typeof OrganizationId.schema>;

const organizationSchema = z.object({
    id: OrganizationId.schema,
    name: z.string().min(5).max(100),
    slug: z
        .string()
        .min(3)
        .max(50)
        .regex(/^[a-z0-9-_]+$/),
    createdAt: z.iso.datetime(),
});

export const OrganizationData = {
    schema: organizationSchema,

    modifiableSchema: organizationSchema.pick({
        name: true,
        slug: true,
    }),

    fromRecord: (record: OrganizationRecord) =>
        OrganizationData.schema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
        }),
};

export type OrganizationData = z.infer<typeof OrganizationData.schema>;

export type OrganizationWithSettings = OrganizationData & {
    settings: OrganizationSettings;
};

export type ModifiableOrganizationData = z.infer<
    typeof OrganizationData.modifiableSchema
>;
