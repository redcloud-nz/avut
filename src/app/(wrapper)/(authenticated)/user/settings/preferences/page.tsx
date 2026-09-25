/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user/settings/preferences
 */

import { UserSettings_PreferencesContent } from "@/components/user-settings/user-settings-content";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export default async function UserSettings_Preferences_Page() {
    prefetch(trpc.settings.getUserSettings.queryOptions());

    return (
        <HydrateClient>
            <UserSettings_PreferencesContent />
        </HydrateClient>
    );
}
