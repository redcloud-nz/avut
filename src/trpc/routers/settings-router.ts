/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import {
    OrganizationSettings,
    OrganizationSettingsSlices,
} from "@/lib/schemas/organization-settings";
import { UserSettings, UserSettingsSlices } from "@/lib/schemas/user-settings";
import { revalidateOrganizationSettings } from "@/server/cache/organization-settings-revalidate";
import {
    getUserSettings,
    revalidateUserSettings,
    writeUserSettingsSlice,
} from "@/server/cache/user-settings";
import {
    readOrganizationSettings,
    writeOrganizationSettingsSlice,
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
     * Apply a patch to one slice of an organization's settings.
     *
     * A card sends only the fields of its own group that changed, and the patch is merged onto
     * the settings as they stand in the database — so two admins saving different cards at the
     * same time no longer overwrite each other with a stale snapshot of the whole tree. The
     * merged group is re-parsed in full, so invariants within a slice still hold.
     *
     * `allowSystemAdmin` lets a site-wide administrator write the settings of an organization
     * they are not a member of — `systemAdminRouter` reuses this procedure directly rather than
     * duplicating it, so the audit entry lands in the target organization's log either way,
     * attributed to the acting user, with no `description` distinguishing the two paths.
     *
     * @param ctx The authenticated context.
     * @param input `update` names the slice to patch and the changed fields of it. It is
     *     nested rather than flat because tRPC can only merge object inputs, and this one is a
     *     discriminated union over the slices.
     * @returns The organization's settings as they stand after the write.
     */
    updateOrganizationSettingsSlice: organizationProcedure(
        { organization: ["update"] },
        { allowSystemAdmin: true },
    )
        .input(z.object({ update: OrganizationSettingsSlices.input }))
        .output(OrganizationSettings.schema)
        .mutation(async ({ ctx, input }) => {
            const settings = await writeOrganizationSettingsSlice(
                ctx.prisma,
                ctx.organizationId,
                OrganizationSettingsSlices.pathOf(input.update.slice),
                input.update.patch,
                (changes) =>
                    ctx.logEvent({
                        action: "Update",
                        objectType: "OrganizationSettings",
                        objectId: ctx.organizationId,
                        changes,
                        description: `Updated ${input.update.slice} settings`,
                    }),
            );

            await revalidateOrganizationSettings(ctx.organizationId);

            return settings;
        }),

    /**
     * Apply a patch to one slice of the current (authenticated) user's settings.
     *
     * See `updateOrganizationSettingsSlice` — this is the same mechanism over the user tree.
     *
     * @param ctx The authenticated context.
     * @param input `update` names the slice to patch and the changed fields of it. It is
     *     nested rather than flat because tRPC can only merge object inputs, and this one is a
     *     discriminated union over the slices.
     * @returns The user's settings as they stand after the write.
     */
    updateUserSettingsSlice: authenticatedProcedure
        .input(z.object({ update: UserSettingsSlices.input }))
        .output(UserSettings.schema)
        .mutation(async ({ ctx, input }) => {
            const settings = await writeUserSettingsSlice(
                ctx.prisma,
                ctx.userId,
                UserSettingsSlices.pathOf(input.update.slice),
                input.update.patch,
                (changes) =>
                    ctx.logEvent({
                        action: "Update",
                        objectType: "UserSettings",
                        objectId: ctx.userId,
                        changes,
                        description: `Updated ${input.update.slice} settings`,
                    }),
            );

            await revalidateUserSettings(ctx.userId);

            return settings;
        }),
});
