/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * PROTOTYPE — fallback for a hard refresh/direct link into a deeper i3 route (e.g.
 * `i3/templates/[template_id]`), which doesn't have its own slot match. Identical to `page.tsx`
 * since the menu doesn't depend on anything below the module segment.
 */

import { I3_Sidebar_Menu } from "@/components/i3/sidebar-menu";

export default function I3_Sidebar_Default() {
    return <I3_Sidebar_Menu />;
}
