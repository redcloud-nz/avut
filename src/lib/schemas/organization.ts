/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { Organization as OrganizationRecord } from "@/generated/prisma/client";

import { nanoId16 } from "../id";
import { zodNanoId16 } from "../validation";

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
    logo: z.url().nullable(),
});

export const OrganizationData = {
    schema: organizationSchema,

    modifiableSchema: organizationSchema.pick({
        name: true,
        slug: true,
    }),

    /**
     * Input schema for creating a new organization (name + slug). Mirrors the slug refinement used
     * by the user-facing `CreateOrganization_Card` (`/orgs/--create`) — lowercase letters, digits,
     * and hyphens — so system-admin-created orgs validate identically to user-created ones.
     */
    createSchema: z.object({
        name: z.string().min(2).max(100),
        slug: z
            .string()
            .min(2)
            .max(50)
            .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only"),
    }),

    fromRecord: (record: OrganizationRecord) =>
        OrganizationData.schema.parse({
            ...record,
            createdAt: record.createdAt.toISOString(),
        }),
};

export type OrganizationData = z.infer<typeof OrganizationData.schema>;

export type ModifiableOrganizationData = z.infer<typeof OrganizationData.modifiableSchema>;

export const OrganizationRef = {
    schema: z.object({
        id: OrganizationId.schema,
        name: z.string().min(5).max(100),
    }),
};

export type OrganizationRef = z.infer<typeof OrganizationRef.schema>;
