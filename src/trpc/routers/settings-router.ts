/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { entries } from "remeda";
import { z } from "zod";

import { OrganizationSettings } from "@/lib/schemas/organization-settings";

import { createTrpcRouter, organizationProcedure } from "../init";

export const settingsRouter = createTrpcRouter({
    /**
     * Get the organization settings for the current organization.
     * @param ctx The authenticated context.
     * @returns The organization settings object.
     */
    getOrganizationSettings: organizationProcedure()
        .output(OrganizationSettings.schema)
        .query(async ({ ctx }) => {
            const records = await ctx.prisma.organizationConfig.findMany({
                where: { organizationId: ctx.organizationId },
            });

            return OrganizationSettings.fromRecords(records);
        }),

    /**
     * Update the organization settings for the current organization.
     * @param ctx The authenticated context.
     * @param input The input object containing the updates to apply.
     * @returns The updated organization settings.
     */
    updateOrganizationSettings: organizationProcedure({
        organization: ["update"],
    })
        .input(
            z.object({
                settings: OrganizationSettings.schema.partial(),
            }),
        )
        .output(OrganizationSettings.schema)
        .mutation(async ({ ctx, input }) => {
            const defaultSettings = OrganizationSettings.schema.parse({});

            // Only update keys that differ from defaults
            const filteredEntries = entries(input.settings).filter(
                ([key, value]) => value !== defaultSettings[key],
            );

            // Prepare updates
            const updates = filteredEntries.map(([key, value]) =>
                ctx.prisma.organizationConfig.upsert({
                    where: {
                        organizationId_key: {
                            organizationId: ctx.organizationId,
                            key: key,
                        },
                    },
                    create: {
                        organizationId: ctx.organizationId,
                        key: key,
                        value: value,
                    },
                    update: {
                        value: value,
                    },
                }),
            );

            // Apply updates
            await Promise.all(updates);

            // Log the update action
            await ctx.logEvent({
                action: "Update",
                objectType: "OrganizationSettings",
                objectId: ctx.organizationId,
            });

            // Fetch updated settings
            const records = await ctx.prisma.organizationConfig.findMany({
                where: { organizationId: ctx.organizationId },
            });

            return OrganizationSettings.fromRecords(records);
        }),
});
