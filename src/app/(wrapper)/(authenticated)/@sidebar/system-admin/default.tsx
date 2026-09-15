/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * PROTOTYPE — fallback for a hard refresh/direct link into a deeper system-admin route (e.g.
 * `/system-admin/organizations`), which doesn't have its own slot match. Identical to `page.tsx`
 * since the menu doesn't depend on anything below the `/system-admin` segment.
 */

import { SystemAdmin_Sidebar_Menu } from "@/components/system-admin/sidebar-menu";

export default function SystemAdmin_Sidebar_Default() {
    return <SystemAdmin_Sidebar_Menu />;
}
