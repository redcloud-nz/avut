/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { UserSettings } from "@/lib/schemas/user-settings";
import { trpc } from "@/trpc/client";

/**
 * The save mutation shared by every user-settings card. Unlike organization settings, there is
 * only one tRPC surface here — a user always edits their own settings — so this needs no
 * scope-provider indirection.
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
    const queryClient = useQueryClient();

    const mutation = useMutation(
        trpc.settings.updateUserSettings.mutationOptions({
            onError(error) {
                toast.error(`${errorMessage}: ${error.message}`);
                mutation.reset();
            },
            async onSuccess(updated) {
                await queryClient.invalidateQueries(trpc.settings.getUserSettings.queryFilter());
                onSaved(updated);
                setTimeout(() => mutation.reset(), 1500);
            },
        }),
    );

    return mutation;
}
