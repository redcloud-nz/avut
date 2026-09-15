/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /system/admin
 */

import { requireSystemAdmin } from "@/server/system-admin-access";

export default async function SystemAdmin_Layout(props: LayoutProps<"/system/admin">) {
    await requireSystemAdmin();

    return props.children;
}
