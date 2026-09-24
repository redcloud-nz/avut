/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useMemo } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Modules, type UserModuleId } from "@/lib/modules";
import { UserSettings } from "@/lib/schemas/user-settings";
import { trpc } from "@/trpc/client";

/**
 * Reads the current (authenticated) user's settings — the general per-user preferences surfaced
 * on `/user/settings/preferences`, not only module toggles. Unlike `useOrganization`, there's no
 * identity to thread through a provider: `settings.getUserSettings` keys off the session's own
 * `ctx.userId`, so this is just a thin `useSuspenseQuery` wrapper.
 */
export function usePreferences(): PreferencesClient {
    const { data: settings } = useSuspenseQuery(trpc.settings.getUserSettings.queryOptions());

    return useMemo(() => new PreferencesClient(settings), [settings]);
}

export class PreferencesClient {
    readonly settings: UserSettings;

    constructor(settings: UserSettings) {
        this.settings = settings;
    }

    /**
     * Whether `moduleId` is enabled for the current user. Every user module is `alwaysOn` today
     * (see `configurableUserModuleIds` in `src/lib/modules.ts`), so this always returns `true`
     * until the first non-`alwaysOn` user module ships.
     */
    isModuleEnabled(moduleId: UserModuleId): boolean {
        const moduleDef = Modules[moduleId];
        if (moduleDef.alwaysOn) return true;

        return this.settings.modules[moduleId as keyof UserSettings["modules"]]?.enabled === true;
    }
}
