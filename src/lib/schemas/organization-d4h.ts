/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { Organization_D4H as OrganizationD4HRecord } from "@/generated/prisma/client";

import { D4HServerCode } from "../d4h-servers";

/**
 * The org-level D4H link (`Organization_D4H`) as seen by the admin UI, plus the
 * count of teams currently linked under it. Phase-1 read model — the Phase-2
 * `syncTokenId` is deliberately omitted.
 */
const organizationD4HSchema = z.object({
    serverCode: D4HServerCode.schema,
    d4hOrganisationId: z.number().nullable(),
    d4hOrganisationName: z.string().nullable(),
    d4hTimezone: z.string().nullable(),
    d4hCurrency: z.string().nullable(),
    d4hReportingStartDay: z.number().nullable(),
    d4hReportingStartMonth: z.number().nullable(),
    lastSyncedAt: z.iso.datetime().nullable(),
    linkedTeamCount: z.number().int().nonnegative(),
});

export const OrganizationD4HData = {
    schema: organizationD4HSchema,

    fromRecord: (record: OrganizationD4HRecord, linkedTeamCount: number): OrganizationD4HData =>
        organizationD4HSchema.parse({
            serverCode: record.serverCode,
            d4hOrganisationId: record.d4hOrganisationId,
            d4hOrganisationName: record.d4hOrganisationName,
            d4hTimezone: record.d4hTimezone,
            d4hCurrency: record.d4hCurrency,
            d4hReportingStartDay: record.d4hReportingStartDay,
            d4hReportingStartMonth: record.d4hReportingStartMonth,
            lastSyncedAt: record.lastSyncedAt?.toISOString() ?? null,
            linkedTeamCount,
        }),
} as const;

export type OrganizationD4HData = z.infer<typeof organizationD4HSchema>;
