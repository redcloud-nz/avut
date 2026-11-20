/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { NavSubItem } from "@/components/nav/nav-section";
import { Protect } from "@/components/protect";
import { useTeamSlug } from "@/hooks/use-team";
import { route } from "@/lib/routes";

/** Nested pages for team admin's `NavCollapsible` section — not a standalone sidebar group. */
export function TeamAdmin_Sidebar_Menu() {
    const slug = useTeamSlug();

    return (
        <Protect permissions={{ team: ["view"] }}>
            <NavSubItem label="Members" href={route("/teams/[slug]/admin/members", { slug })} />
        </Protect>
    );
}
