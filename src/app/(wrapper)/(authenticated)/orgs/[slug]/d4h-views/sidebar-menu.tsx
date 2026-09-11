/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { NavItem } from "@/components/nav/nav-section";
import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar";

import { route } from "@/lib/routes";

import { useOrganization } from "@/hooks/use-organization";

export function D4HViews_Sidebar_Menu() {
    const { slug } = useOrganization();

    return (
        <SidebarGroup>
            <SidebarMenu>
                <NavItem
                    label="Equipment"
                    href={route("/orgs/[slug]/d4h-views/equipment", { slug })}
                />
                <NavItem label="Members" href={route("/orgs/[slug]/d4h-views/members", { slug })} />
            </SidebarMenu>
        </SidebarGroup>
    );
}
