/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { UserSettingsForm } from "@/components/user-settings/user-settings-form";
import { trpc } from "@/trpc/client";

export function UserSettings_PreferencesContent() {
    const { data: settings } = useSuspenseQuery(trpc.settings.getUserSettings.queryOptions());

    return (
        <>
            <Std.Navbar
                breadcrumbs={[{ label: "User Settings", href: "/user/settings" }, "Preferences"]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Preferences</Saratoga.Title>
                    </Saratoga.Header>

                    <UserSettingsForm settings={settings} />
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
