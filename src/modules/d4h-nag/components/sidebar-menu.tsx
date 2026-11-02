/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { NavSubItem } from "@/components/nav/nav-section";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";

/**
 * Nested pages for the D4H Attendance Reminders module's `NavCollapsible` section. The whole
 * section is hidden from a caller without `d4hNag: ["view"]` (`OrgSidebar_Modules`), so the entries
 * need no gate of their own.
 */
export function D4HNag_Sidebar_Menu() {
    const organization = useOrganization();
    const { slug } = organization;

    return (
        <>
            <NavSubItem label="Rules" href={route("/orgs/[slug]/d4h-nag", { slug })} />
            <NavSubItem label="Opt-outs" href={route("/orgs/[slug]/d4h-nag/opt-outs", { slug })} />
        </>
    );
}
