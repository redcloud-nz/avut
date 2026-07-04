/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ModuleIcons, OrgDashboardIcon } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { NavCollapsible, NavItem, NavSubItem } from "@/components/nav/nav-section";
import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar";

import { route } from "@/lib/routes";
import { OrganizationData } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";

export async function SkillTrack_Sidebar_Menu({
    organization,
    settings,
}: {
    organization: OrganizationData;
    settings: OrganizationSettings;
}) {
    const { slug } = organization;
    const { modules } = settings;

    return (
        <SidebarGroup>
            <SidebarMenu>
                <NavItem
                    label="Dashboard"
                    href={route("/skill-track/[slug]", { slug })}
                    icon={<OrgDashboardIcon />}
                />
                {/* <NavCollapsible
                    label="Admin"
                    href={route("/main/[slug]/admin", { slug })}
                    icon={<ModuleIcons.Admin />}
                >
                    <Protect permissions={{ member: ["view"] }} orgId={organization.id}>
                        <NavSubItem
                            label="Access Control"
                            href={route("/main/[slug]/admin/access", { slug })}
                        />
                    </Protect>
                    <Protect permissions={{ d4hAccessToken: ["view"] }} orgId={organization.id}>
                        <NavSubItem
                            label="D4H Access Tokens"
                            href={route("/main/[slug]/admin/d4h-access-tokens", { slug })}
                        />
                    </Protect>
                    <NavSubItem
                        label="Organization"
                        href={route("/main/[slug]/admin/organization", { slug })}
                    />
                    <NavSubItem
                        label="Personnel"
                        href={route("/main/[slug]/admin/personnel", { slug })}
                    />
                    <Protect permissions={{ organization: ["update"] }} orgId={organization.id}>
                        <NavSubItem
                            label="Organization Settings"
                            href={route("/main/[slug]/admin/organization/settings", { slug })}
                        />
                    </Protect>
                    <NavSubItem label="Teams" href={route("/main/[slug]/admin/teams", { slug })} />
                </NavCollapsible> */}

                <NavItem
                    label="Catalogue"
                    href={route("/skill-track/[slug]/catalogue", { slug })}
                />
                <NavItem label="Checks" href={route("/skill-track/[slug]/checks", { slug })} />
                <NavItem label="Sessions" href={route("/skill-track/[slug]/sessions", { slug })} />
                <NavItem label="Reports" href={route("/skill-track/[slug]/reports", { slug })} />
            </SidebarMenu>
        </SidebarGroup>
    );
}
