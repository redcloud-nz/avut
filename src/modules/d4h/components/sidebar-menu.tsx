/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { NavSubItem } from "@/components/nav/nav-section";
import { Protect } from "@/components/protect";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";

/** Nested pages for the D4H module's `NavCollapsible` section — not a standalone sidebar group. */
export function D4H_Sidebar_Menu() {
    const organization = useOrganization();
    const { slug } = organization;

    return (
        <>
            <NavSubItem label="Teams" href={route("/orgs/[slug]/d4h/teams", { slug })} />
            <NavSubItem label="Equipment" href={route("/orgs/[slug]/d4h/equipment", { slug })} />
            <NavSubItem label="Members" href={route("/orgs/[slug]/d4h/members", { slug })} />
            <Protect permissions={{ d4hTask: ["view"] }}>
                <NavSubItem label="Tasks" href={route("/orgs/[slug]/d4h/tasks", { slug })} />
            </Protect>
        </>
    );
}
