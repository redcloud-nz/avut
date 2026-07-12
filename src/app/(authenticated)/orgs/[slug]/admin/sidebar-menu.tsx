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

export function Admin_Sidebar_Menu() {
    const organization = useOrganization();
    const { slug } = organization;

    return (
        <SidebarGroup>
            <SidebarMenu>
                <NavItem
                    label="Dashboard"
                    href={route("/orgs/[slug]/admin", { slug })}
                    icon={<OrgDashboardIcon />}
                />
                <Protect orgId={organization.id} permissions={{ member: ["view"] }}>
                    <NavItem
                        label="Access Control"
                        href={route("/orgs/[slug]/admin/access", { slug })}
                    />
                </Protect>
                <Protect orgId={organization.id} permissions={{ d4hAccessToken: ["view"] }}>
                    <NavItem
                        label="D4H Access Tokens"
                        href={route("/orgs/[slug]/admin/d4h-access-tokens", { slug })}
                    />
                </Protect>
                <NavItem
                    label="Organization"
                    href={route("/orgs/[slug]/admin/organization", { slug })}
                />
                <NavItem label="Personnel" href={route("/orgs/[slug]/admin/personnel", { slug })} />
                <Protect orgId={organization.id} permissions={{ organization: ["update"] }}>
                    <NavItem
                        label="Organization Settings"
                        href={route("/orgs/[slug]/admin/organization/settings", { slug })}
                    />
                </Protect>
                <NavItem label="Teams" href={route("/orgs/[slug]/admin/teams", { slug })} />
            </SidebarMenu>
        </SidebarGroup>
    );
}
