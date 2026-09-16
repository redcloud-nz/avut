/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { NavSubItem } from "@/components/nav/nav-section";

import { route } from "@/lib/routes";

import { useOrganization } from "@/hooks/use-organization";

/** Nested pages for the D4H Views module's `NavCollapsible` section — not a standalone sidebar group. */
export function D4HViews_Sidebar_Menu() {
    const organization = useOrganization();
    const { slug } = organization;

    return (
        <>
            <NavSubItem
                label="Equipment"
                href={route("/orgs/[slug]/d4h-views/equipment", { slug })}
            />
            <NavSubItem label="Members" href={route("/orgs/[slug]/d4h-views/members", { slug })} />
        </>
    );
}
