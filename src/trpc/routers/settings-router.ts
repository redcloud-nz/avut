/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { UserSettings } from "@/lib/schemas/user-settings";
import { revalidateOrganizationSettings } from "@/server/cache/organization-settings-revalidate";
import {
    getUserSettings,
    revalidateUserSettings,
    writeUserSettings,
} from "@/server/cache/user-settings";
import {
    readOrganizationSettings,
    writeOrganizationSettings,
} from "@/server/organization-settings-store";

import { authenticatedProcedure, createTrpcRouter, organizationProcedure } from "../init";

export const settingsRouter = createTrpcRouter({
    /**
     * Get the organization settings for a given organization.
     *
     * `allowSystemAdmin` lets a site-wide administrator read the settings of an organization
     * they are not a member of, which is what the system-administration organization screens
     * need — previously a separate `systemAdmin.getOrganizationSettings` procedure.
     *
     * Reads uncached, through the injected `ctx.prisma`, rather than the `"use cache"`-backed
     * `getOrganizationSettings` in `@/server/cache/organization-settings` (used elsewhere by
     * Server Components) — that helper closes over the real `@/server/prisma` singleton instead
     * of taking a client, which is exactly what `.claude/rules/testing.md` says a router must
     * not depend on: it would silently ignore a test's mock `ctx.prisma` and hit the real
     * database. It still resolves identically for a config-less organization (the normal
     * org-creation path seeds no rows) and a fully materialised one (`systemAdmin.createOrganization`
     * seeds every default leaf), since both fall back to `OrganizationSettings.default()`.
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
     * Get the settings for the current (authenticated) user.
     *
     * @param ctx The authenticated context.
     * @returns The user's settings object.
     */
    getUserSettings: authenticatedProcedure.output(UserSettings.schema).query(async ({ ctx }) => {
        return await getUserSettings(ctx.userId);
    }),

    /**
     * Update the organization settings for a given organization.
     *
     * `allowSystemAdmin` lets a site-wide administrator write the settings of an organization
     * they are not a member of — `systemAdminRouter` reuses this procedure directly rather than
     * duplicating it, so the audit entry lands in the target organization's log either way,
     * attributed to the acting user, with no `description` distinguishing the two paths.
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

    /**
     * Update the settings for the current (authenticated) user.
     *
     * Only the config leaves whose value actually changed are upserted, and the audit entry
     * rides in the same transaction.
     *
     * @param ctx The authenticated context.
     * @param input The input object containing the updates to apply.
     * @returns The updated user settings.
     */
    updateUserSettings: authenticatedProcedure
        .input(
            z.object({
                settings: UserSettings.schema,
            }),
        )
        .output(UserSettings.schema)
        .mutation(async ({ ctx, input }) => {
            const settings = await writeUserSettings(
                ctx.prisma,
                ctx.userId,
                input.settings,
                (changes) =>
                    ctx.logEvent({
                        action: "Update",
                        objectType: "UserSettings",
                        objectId: ctx.userId,
                        changes,
                    }),
            );

            await revalidateUserSettings(ctx.userId);

            return settings;
        }),
});
