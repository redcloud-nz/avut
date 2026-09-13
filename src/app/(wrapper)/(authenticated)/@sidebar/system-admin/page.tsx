/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * PROTOTYPE — see `../orgs/[slug]/i3/page.tsx` for the caveats this pattern still needs solving.
 * No module switcher here yet — `OrgModuleListMenu` only covers the org scope; a global-scope
 * equivalent can follow the same pattern when needed.
 */

import { SystemAdmin_Sidebar_Menu } from "@/components/system-admin/sidebar-menu";

export default function SystemAdmin_Sidebar_Slot() {
    return <SystemAdmin_Sidebar_Menu />;
}
