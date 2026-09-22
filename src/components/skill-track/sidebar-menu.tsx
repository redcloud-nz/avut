/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { NavSubItem } from "@/components/nav/nav-section";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";

/** Nested pages for the Skill Track module's `NavCollapsible` section — not a standalone sidebar group. */
export function SkillTrack_Sidebar_Menu() {
    const organization = useOrganization();

    return (
        <>
            <NavSubItem
                label="Catalogue"
                href={route("/orgs/[slug]/skill-track/catalogue", { slug: organization.slug })}
            />
            <NavSubItem
                label="Checks"
                href={route("/orgs/[slug]/skill-track/checks", { slug: organization.slug })}
            />
            <NavSubItem
                label="Sessions"
                href={route("/orgs/[slug]/skill-track/sessions", { slug: organization.slug })}
            />
            <NavSubItem
                label="Reports"
                href={route("/orgs/[slug]/skill-track/reports", { slug: organization.slug })}
            />
        </>
    );
}
