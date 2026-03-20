/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

export const D4HOrganisation = {
    schema: z.object({
        id: z.number(),
        resourceType: z.literal("Organisation"),
        title: z.string(),
        timezone: z.string(),
        currency: z.string(),
        reportingStartDay: z.number(),
        reportingStartMonth: z.number(),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
    }),
} as const;

export type D4HOrganisation = z.infer<typeof D4HOrganisation.schema>;
