/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { settingsEffects } from "@/client/settings-effects";
import { UserSettings } from "@/lib/schemas/user-settings";
import { trpc } from "@/trpc/client";

/**
 * The save mutation shared by every user-settings card. A user always edits their own settings,
 * so the procedure takes no owner — only which slice to patch.
 *
 * Cards send a patch to their own slice (`mutate({ slice, patch })`) rather than the whole
 * settings tree, so two cards saving at once no longer clobber each other.
 *
 * The cache write itself is declared once as `meta.effects` (`settingsEffects.updateUserSettings`)
 * rather than here — this hook's `onSuccess` only handles the form-reset and toast concerns
 * `useMutationEffector` doesn't.
 *
 * `onSaved` receives the settings as they stand after the write, for the card to `form.reset(...)`
 * its own slice from.
 */
export function useUserSettingsMutation({
    errorMessage,
    onSaved,
}: {
    /** Prefix for the error toast, e.g. `"Failed to update module settings"`. */
    errorMessage: string;
    onSaved: (updated: UserSettings) => void;
}) {
    const mutation = useMutation(
        trpc.settings.updateUserSettingsSlice.mutationOptions({
            meta: { effects: settingsEffects.updateUserSettingsSlice },
            onError(error) {
                toast.error(`${errorMessage}: ${error.message}`);
                mutation.reset();
            },
            onSuccess(updated) {
                onSaved(updated);
                setTimeout(() => mutation.reset(), 1500);
            },
        }),
    );

    return mutation;
}
