/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { settingsEffects } from "@/client/settings-effects";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { trpc } from "@/trpc/client";

/**
 * The save mutation shared by every organization-settings card.
 *
 * Cards send a patch to their own slice (`mutate({ organizationId, slice, patch })`) rather than
 * the whole settings tree, so two admins saving different cards no longer clobber each other.
 *
 * There is one tRPC surface here regardless of who is calling:
 * `settings.updateOrganizationSettingsSlice` is declared `allowSystemAdmin`, so a site-wide
 * administrator editing an organization they don't belong to goes through the same procedure as
 * one of its own admins. (It used to be mirrored by `systemAdmin.updateOrganizationSettings`,
 * which forced a runtime scope branch here and kept these cards off `meta.effects`.)
 *
 * The cache writes are declared once as `meta.effects`
 * (`settingsEffects.updateOrganizationSettings`) rather than here — this hook's `onSuccess` only
 * handles the form-reset and toast concerns `useMutationEffector` doesn't.
 *
 * `onSaved` receives the settings as they stand after the write, for the card to `form.reset(...)`
 * its own slice from. The target organization is named by each `mutate({ organizationId, ... })`
 * call, and the effects read it back off those variables, so this hook takes no id of its own.
 */
export function useOrganizationSettingsMutation({
    errorMessage,
    onSaved,
}: {
    /** Prefix for the error toast, e.g. `"Failed to update email integration settings"`. */
    errorMessage: string;
    onSaved: (updated: OrganizationSettings) => void;
}) {
    const mutation = useMutation(
        trpc.settings.updateOrganizationSettingsSlice.mutationOptions({
            meta: { effects: settingsEffects.updateOrganizationSettingsSlice },
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
