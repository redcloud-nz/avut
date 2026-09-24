/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { revalidateOrganizationSettings } from "@/server/cache/organization-settings-revalidate";
import {
    readOrganizationSettings,
    writeOrganizationSettings,
} from "@/server/organization-settings-store";

import { createTrpcRouter, organizationProcedure } from "../init";

export const settingsRouter = createTrpcRouter({
    /**
     * Get the organization settings for the current organization.
     *
     * Reads uncached, through the injected `ctx.prisma`, rather than the `"use cache"`-backed
     * `getOrganizationSettings` in `@/server/cache/organization-settings` (used elsewhere by
     * Server Components) — that helper closes over the real `@/server/prisma` singleton
     * instead of taking a client, which is exactly what `.claude/rules/testing.md` says a
     * router must not depend on: it would silently ignore a test's mock `ctx.prisma` and hit
     * the real database.
     *
     * @param ctx The authenticated context.
     * @returns The organization settings object.
     */
    getOrganizationSettings: organizationProcedure(
        { organization: ["view"] },
        { allowSystemAdmin: true },
    )
        .output(OrganizationSettings.schema)
        .query(async ({ ctx }) => {
            return await readOrganizationSettings(ctx.prisma, ctx.organizationId);
        }),

    /**
     * Update the organization settings for the current organization.
     *
     * Shares its write path (`writeOrganizationSettings`) with
     * `systemAdmin.updateOrganizationSettings` — they're the same procedure, reused directly
     * from `system-admin-router.ts` via `{ allowSystemAdmin: true }` rather than duplicated.
     * Only the config leaves whose value actually changed are upserted, and the audit entry
     * rides in the same transaction.
     *
     * @param ctx The authenticated context.
     * @param input The input object containing the updates to apply.
     * @returns The updated organization settings.
     */
    updateOrganizationSettings: organizationProcedure(
        { organization: ["update"] },
        { allowSystemAdmin: true },
    )
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
