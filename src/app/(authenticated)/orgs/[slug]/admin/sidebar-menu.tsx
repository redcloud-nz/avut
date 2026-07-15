/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

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
                <Protect orgId={organization.id} permissions={{ invitation: ["view"] }}>
                    <NavItem
                        label="Invitations"
                        href={route("/orgs/[slug]/admin/invitations", { slug })}
                    />
                </Protect>
                <NavItem
                    label="Organization"
                    href={route("/orgs/[slug]/admin/organization", { slug })}
                />
                <Protect orgId={organization.id} permissions={{ person: ["view"] }}>
                    <NavItem
                        label="Personnel"
                        href={route("/orgs/[slug]/admin/personnel", { slug })}
                    />
                </Protect>
                <Protect orgId={organization.id} permissions={{ team: ["view"] }}>
                    <NavItem label="Teams" href={route("/orgs/[slug]/admin/teams", { slug })} />
                </Protect>
                <Protect orgId={organization.id} permissions={{ member: ["view"] }}>
                    <NavItem label="Users" href={route("/orgs/[slug]/admin/users", { slug })} />
                </Protect>
            </SidebarMenu>
        </SidebarGroup>
    );
}
