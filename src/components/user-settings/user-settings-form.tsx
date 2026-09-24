/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { UserDisplay_SettingsCard } from "@/components/user-settings/display-card";
import { UserModules_SettingsCard } from "@/components/user-settings/modules-card";
import { configurableUserModuleIds } from "@/lib/modules";
import { UserSettings } from "@/lib/schemas/user-settings";

/**
 * The full user-settings form: a stack of independently-saved cards, one per group of
 * preferences ("Display", and "Modules" once there's a configurable one). Mirrors
 * `OrganizationSettingsForm`, minus the multi-scope indirection — a user only ever edits their
 * own settings.
 *
 * The "Modules" section is omitted entirely while no user module has anything configurable —
 * see `configurableUserModuleIds`.
 */
export function UserSettingsForm({ settings }: { settings: UserSettings }) {
    return (
        <div className="space-y-8 pt-6">
            <div className="space-y-4">
                <h3 className="text-lg font-semibold tracking-tight">Display</h3>
                <UserDisplay_SettingsCard settings={settings} />
            </div>

            {configurableUserModuleIds.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold tracking-tight">Modules</h3>
                    <UserModules_SettingsCard settings={settings} />
                </div>
            )}
        </div>
    );
}
