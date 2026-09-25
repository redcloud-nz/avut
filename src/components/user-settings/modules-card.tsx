/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemAction, DataItemTitle, DataItemValue } from "@/components/ui/data-item";
import { UserModules_UpdateSettings_Dialog } from "@/components/user-settings/update-modules-settings-dialog";
import { userModules as allUserModules, configurableUserModuleIds } from "@/lib/modules";
import { UserSettings } from "@/lib/schemas/user-settings";

const userModules = allUserModules.filter((m) => configurableUserModuleIds.includes(m.id));

/**
 * Per-user module preferences — mirrors the organization settings "Modules" section, keyed by
 * `UserModuleId` instead of `OrganizationModuleId`. Renders nothing while
 * `configurableUserModuleIds` is empty (every user module is currently `alwaysOn`, see
 * `src/lib/modules.ts`) rather than showing switches that don't gate anything — this is the
 * scaffolding for per-module preferences called for in issue #93, ready for the first module
 * that actually needs one.
 */
export function UserModules_SettingsCard({ settings }: { settings: UserSettings }) {
    if (userModules.length === 0) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Modules</CardTitle>
            </CardHeader>
            <CardContent>
                {userModules.map((module, index) => (
                    <DataItem key={module.id}>
                        <DataItemTitle>{module.label}</DataItemTitle>
                        <DataItemValue>
                            {settings.modules[module.id as keyof UserSettings["modules"]]?.enabled
                                ? "Enabled"
                                : "Disabled"}
                        </DataItemValue>
                        <DataItemAction>
                            {index === 0 && (
                                <UserModules_UpdateSettings_Dialog settings={settings} />
                            )}
                        </DataItemAction>
                    </DataItem>
                ))}
            </CardContent>
        </Card>
    );
}
