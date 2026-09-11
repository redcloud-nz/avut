/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user-settings
 */

import { requireSession } from "@/server/session";

import { UserSettings_Dialog } from "./user-settings-dialog";

export default async function UserSettings_Modal_Page() {
    await requireSession();

    return <UserSettings_Dialog />;
}
