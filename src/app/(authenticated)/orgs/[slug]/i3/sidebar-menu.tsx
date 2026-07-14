/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { OrgDashboardIcon } from "@/components/icons";
import { NavItem } from "@/components/nav/nav-section";
import { Protect } from "@/components/protect";
import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar";

import { route } from "@/lib/routes";

import { useOrganization } from "@/hooks/use-organization";

export function I3_Sidebar_Menu() {
    const organization = useOrganization();
    const { slug } = organization;

    return (
        <SidebarGroup>
            <SidebarMenu>
                <Protect orgId={organization.id} permissions={{ i3Item: ["view"] }}>
                    <NavItem
                        label="By Equipment Kind"
                        href={route("/orgs/[slug]/i3/equipment-kinds", { slug })}
                    />
                </Protect>
                <Protect orgId={organization.id} permissions={{ i3Item: ["view"] }}>
                    <NavItem label="By Member" href={route("/orgs/[slug]/i3/members", { slug })} />
                </Protect>
                <Protect orgId={organization.id} permissions={{ i3Item: ["inspect"] }}>
                    <NavItem label="Inspect" href={route("/orgs/[slug]/i3/inspect", { slug })} />
                </Protect>
                <Protect orgId={organization.id} permissions={{ i3Item: ["issue"] }}>
                    <NavItem
                        label="Issue"
                        href={route("/orgs/[slug]/i3/forms/issue-items", { slug })}
                    />
                </Protect>
                <Protect orgId={organization.id} permissions={{ i3Item: ["return"] }}>
                    <NavItem
                        label="Return"
                        href={route("/orgs/[slug]/i3/forms/return-items", { slug })}
                    />
                </Protect>
                <Protect orgId={organization.id} permissions={{ i3Template: ["view"] }}>
                    <NavItem
                        label="Templates"
                        href={route("/orgs/[slug]/i3/templates", { slug })}
                    />
                </Protect>
            </SidebarMenu>
        </SidebarGroup>
    );
}
