/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { usePreferences } from "@/hooks/use-preferences";
import { configurableUserModuleIds } from "@/lib/modules";

import { UserSettings_DateTime_Card } from "./datetime-settings";
import { UserSettings_UserModules_Card } from "./user-modules";

export function UserSettings_PreferencesContent() {
    const { settings } = usePreferences();

    return (
        <>
            <Std.Navbar breadcrumbs={["User Settings", "Preferences"]} />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Preferences</Saratoga.Title>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <div className="space-y-8 pt-6">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold tracking-tight">
                                        Display
                                    </h3>
                                    <UserSettings_DateTime_Card settings={settings} />
                                </div>

                                {configurableUserModuleIds.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold tracking-tight">
                                            Modules
                                        </h3>
                                        <UserSettings_UserModules_Card settings={settings} />
                                    </div>
                                )}
                            </div>
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary" />
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
