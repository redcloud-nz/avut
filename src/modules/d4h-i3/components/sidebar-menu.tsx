/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { NavSubItem } from "@/components/nav/nav-section";
import { Protect } from "@/components/protect";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";

/** Nested pages for the D4H I3 module's `NavCollapsible` section — not a standalone sidebar group. */
export function D4HI3_Sidebar_Menu() {
    const organization = useOrganization();
    const { slug } = organization;

    return (
        <>
            <Protect permissions={{ i3Item: ["inspect"] }}>
                <NavSubItem label="Inspect" href={route("/orgs/[slug]/d4h-i3/inspect", { slug })} />
            </Protect>
            <Protect permissions={{ i3Item: ["issue"] }}>
                <NavSubItem
                    label="Issue"
                    href={route("/orgs/[slug]/d4h-i3/forms/issue-items", { slug })}
                />
            </Protect>
            <Protect permissions={{ i3Item: ["return"] }}>
                <NavSubItem
                    label="Return"
                    href={route("/orgs/[slug]/d4h-i3/forms/return-items", { slug })}
                />
            </Protect>
            <Protect permissions={{ i3Template: ["view"] }}>
                <NavSubItem
                    label="Templates"
                    href={route("/orgs/[slug]/d4h-i3/templates", { slug })}
                />
            </Protect>
        </>
    );
}
