/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user-settings
 */

import Link from "next/link";

import { AVUTLogo } from "@/components/art/avut-logo";
import { UserSettings_PageContent } from "@/components/user-settings/settings-page";
import { requireSession } from "@/server/session";

export default async function Settings_Page() {
    await requireSession();

    return (
        <div className="w-full max-w-2xl mx-auto p-4 space-y-4">
            <div>
                <Link href="/orgs/--select-org">
                    <AVUTLogo />
                </Link>
            </div>
            <UserSettings_PageContent />
        </div>
    );
}
