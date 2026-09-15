/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * PROTOTYPE — see `../../orgs/[slug]/i3/page.tsx` for the caveats this pattern still needs
 * solving. The `ScopeSwitcher` (in the authenticated layout) covers picking a scope; this is
 * only the system module's own nav within it.
 */

import { SystemAdmin_Sidebar_Menu } from "@/components/system-admin/sidebar-menu";

export default function SystemAdmin_Sidebar_Slot() {
    return <SystemAdmin_Sidebar_Menu />;
}
