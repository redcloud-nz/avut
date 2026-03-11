/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as R from "remeda";
import * as z from "zod";

import { diffObject } from "@/lib/diff";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import {
    getOrganizationSettings,
    revalidateOrganizationSettings,
} from "@/server/organization-settings";

import { createTrpcRouter, organizationProcedure } from "../init";

export const settingsRouter = createTrpcRouter({
    /**
     * Get the organization settings for the current organization.
     * @param ctx The authenticated context.
     * @returns The organization settings object.
     */
    getOrganizationSettings: organizationProcedure({ organization: ["view"] })
        .output(OrganizationSettings.schema)
        .query(async ({ ctx }) => {
            return await getOrganizationSettings(ctx.organizationId);
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
                settings: OrganizationSettings.schema,
            }),
        )
        .output(OrganizationSettings.schema)
        .mutation(async ({ ctx, input }) => {
            const existings = await getOrganizationSettings(ctx.organizationId);

            const flattenedExistings = OrganizationSettings.flatten(existings);
            const flattenedInput = OrganizationSettings.flatten(input.settings);

            const updates = R.pipe(
                R.entries(flattenedInput),
                R.filter(([key, newValue]) => {
                    const existingValue = flattenedExistings[key];
                    return newValue != existingValue;
                }),
                R.map(([key, value]) => {
                    return ctx.prisma.organizationConfig.upsert({
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
                    });
                }),
            );

            // Apply updates
            await Promise.all(updates);

            const changes = diffObject(flattenedExistings, flattenedInput);

            // Log the update action
            await ctx.logEvent({
                action: "Update",
                objectType: "OrganizationSettings",
                objectId: ctx.organizationId,
                changes,
            });

            // Fetch updated settings
            const records = await ctx.prisma.organizationConfig.findMany({
                where: { organizationId: ctx.organizationId },
            });

            await revalidateOrganizationSettings(ctx.organizationId);

            return OrganizationSettings.fromRecords(records);
        }),
});
