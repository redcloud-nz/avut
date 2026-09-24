/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, write } from "@/trpc/mutation-effector";

/**
 * Cache effects for `settings` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 * `updateOrganizationSettings` isn't declared here — it still writes its cache side-effects
 * manually via `useOrganizationSettingsMutation`, since it also needs to target either
 * `settings.*` or `systemAdmin.*` depending on scope (see `settings-scope.tsx`).
 */
export const settingsEffects = createEffects<"settings">()({
    updateUserSettings: (_vars, updated) => [
        write(trpc.settings.getUserSettings.queryKey(), updated),
    ],
});
