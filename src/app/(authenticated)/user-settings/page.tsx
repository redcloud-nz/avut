/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user-settings
 */

"use client";

import { AVUTLogo } from "@/components/art/avut-logo";
import { UserSettings_PageContent } from "@/components/user-settings/settings-page";

export default function Settings_Page(props: PageProps<"/user-settings">) {
    return (
        <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
            <div>
                <AVUTLogo />
            </div>
            <UserSettings_PageContent />
        </div>
    );
}
