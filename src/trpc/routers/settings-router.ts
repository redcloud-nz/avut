/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import {
    getOrganizationSettings,
    revalidateOrganizationSettings,
    writeOrganizationSettings,
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
     *
     * Shares its write path (`writeOrganizationSettings`) with
     * `systemAdmin.updateOrganizationSettings`: only the config leaves whose value actually
     * changed are upserted, and the audit entry rides in the same transaction.
     *
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
            const settings = await writeOrganizationSettings(
                ctx.prisma,
                ctx.organizationId,
                input.settings,
                (changes) =>
                    ctx.logEvent({
                        action: "Update",
                        objectType: "OrganizationSettings",
                        objectId: ctx.organizationId,
                        changes,
                    }),
            );

            await revalidateOrganizationSettings(ctx.organizationId);

            return settings;
        }),
});
