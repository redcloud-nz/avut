/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { UserModules_SettingsCard } from "@/components/user-settings/modules-card";
import { configurableUserModuleIds } from "@/lib/modules";
import { UserSettings } from "@/lib/schemas/user-settings";

/**
 * The full user-settings form: a stack of independently-saved cards, one per group of
 * preferences (currently just "Modules"). Mirrors `OrganizationSettingsForm`, minus the
 * multi-scope indirection — a user only ever edits their own settings.
 *
 * The "Modules" section is omitted entirely while no user module has anything configurable —
 * see `configurableUserModuleIds`. This page is for per-user preferences generally, not only
 * module ones, so the empty state below is worded accordingly — it'll read oddly once the first
 * non-module preference is added and should be revisited then.
 */
export function UserSettingsForm({ settings }: { settings: UserSettings }) {
    if (configurableUserModuleIds.length === 0) {
        return (
            <Empty>
                <EmptyHeader>
                    <EmptyTitle>Nothing to configure yet</EmptyTitle>
                    <EmptyDescription>
                        Personal preferences will show up here as they&apos;re added.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    return (
        <div className="space-y-4 pt-6">
            <h3 className="text-lg font-semibold tracking-tight">Modules</h3>
            <UserModules_SettingsCard settings={settings} />
        </div>
    );
}
