/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /system-admin
 */

import { redirect } from "next/navigation";

import { requireGlobalAdmin } from "@/server/system-admin-access";

export default async function SystemAdmin_Index_Page() {
    await requireGlobalAdmin();

    redirect("/system-admin/users");
}
