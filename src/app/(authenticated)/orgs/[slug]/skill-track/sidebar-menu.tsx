/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { OrgDashboardIcon } from "@/components/icons";
import { NavItem } from "@/components/nav/nav-section";
import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar";

import { route } from "@/lib/routes";

import { useOrganization } from "@/hooks/use-organization";

export function SkillTrack_Sidebar_Menu() {
    const organization = useOrganization();

    return (
        <SidebarGroup>
            <SidebarMenu>
                <NavItem
                    label="Dashboard"
                    href={route("/orgs/[slug]/skill-track", { slug: organization.slug })}
                    icon={<OrgDashboardIcon />}
                />

                <NavItem
                    label="Catalogue"
                    href={route("/orgs/[slug]/skill-track/catalogue", { slug: organization.slug })}
                />
                <NavItem
                    label="Checks"
                    href={route("/orgs/[slug]/skill-track/checks", { slug: organization.slug })}
                />
                <NavItem
                    label="Sessions"
                    href={route("/orgs/[slug]/skill-track/sessions", { slug: organization.slug })}
                />
                <NavItem
                    label="Reports"
                    href={route("/orgs/[slug]/skill-track/reports", { slug: organization.slug })}
                />
            </SidebarMenu>
        </SidebarGroup>
    );
}
