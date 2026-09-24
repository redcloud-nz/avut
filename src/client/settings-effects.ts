/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate, write } from "@/trpc/mutation-effector";

/**
 * Cache effects for `settings` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const settingsEffects = createEffects<"settings">()({
    updateOrganizationSettings: ({ organizationId }, updated) => [
        write(trpc.settings.getOrganizationSettings.queryKey({ organizationId }), updated),
        // `enabledModules` on the system-administration organization screens is derived from the
        // same config rows, so a settings save leaves those lists stale otherwise. Invalidating a
        // query this viewer has never loaded is a no-op, so both scopes can declare it flatly
        // rather than branching on who is calling.
        invalidate(trpc.systemAdmin.getOrganization.queryFilter({ organizationId })),
        invalidate(trpc.systemAdmin.listOrganizations.queryFilter()),
    ],
    updateUserSettings: (_vars, updated) => [
        write(trpc.settings.getUserSettings.queryKey(), updated),
    ],
});
