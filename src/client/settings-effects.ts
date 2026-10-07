/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    OrganizationSettings,
    OrganizationSettingsSlices,
} from "@/lib/schemas/organization-settings";
import { trpc } from "@/trpc/client";
import { createEffects, invalidate, write } from "@/trpc/mutation-effector";

type SettingsTree = Record<string, unknown>;

/**
 * `cached` with only the fields at `path` named in `fields` taken from `updated`.
 *
 * Settings switches save the moment they're flipped, so two quick saves can resolve out of order.
 * Writing a whole response over the cache would then let the older response put back a value the
 * newer one had already changed. Each response is only authoritative for the fields its own patch
 * set, so that's all it writes. The merge is per field rather than per slice because the two
 * Personnel switches share one slice.
 */
function mergePatchedFields<T extends object>(
    cached: T,
    updated: T,
    path: string[],
    fields: string[],
): T {
    const [head, ...rest] = path;
    const cachedTree = cached as SettingsTree;
    const updatedTree = updated as SettingsTree;

    if (head === undefined) {
        const merged: SettingsTree = { ...cachedTree };
        for (const field of fields) merged[field] = updatedTree[field];
        return merged as T;
    }

    return {
        ...cachedTree,
        [head]: mergePatchedFields(
            (cachedTree[head] ?? {}) as object,
            (updatedTree[head] ?? {}) as object,
            rest,
            fields,
        ),
    } as T;
}

/**
 * Cache effects for `settings` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const settingsEffects = createEffects<"settings">()({
    updateOrganizationSettingsSlice: ({ organizationId, update }, updated) => [
        write(trpc.settings.getOrganizationSettings.queryKey({ organizationId }), (cached) =>
            cached
                ? mergePatchedFields<OrganizationSettings>(
                      cached,
                      updated,
                      OrganizationSettingsSlices.pathOf(update.slice),
                      Object.keys(update.patch),
                  )
                : updated,
        ),
        // `enabledModules` on the system-administration organization screens is derived from the
        // same config rows, so a settings save leaves those lists stale otherwise. Invalidating a
        // query this viewer has never loaded is a no-op, so both scopes can declare it flatly
        // rather than branching on who is calling.
        invalidate(trpc.organizations.getOrganizationAsAdmin.queryFilter({ organizationId })),
        invalidate(trpc.organizations.listOrganizations.queryFilter()),
    ],
    updateUserSettingsSlice: (_vars, updated) => [
        write(trpc.settings.getUserSettings.queryKey(), updated),
    ],
});
