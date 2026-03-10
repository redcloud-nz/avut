/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ModuleIcons, OrgDashboardIcon } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar";

import { OrganizationData } from "@/lib/schemas/organization";
import * as Paths from "@/paths";
import { getOrganizationSettings } from "@/server/organization-settings";

import { NavCollapsible, NavItem, NavSubItem } from "./nav-section";

export async function NavOrganizationMenu({
    organization,
}: {
    organization: OrganizationData;
}) {
    const orgPrefix = Paths.main(organization.slug);

    const { modules } = await getOrganizationSettings(organization.id);

    return (
        <SidebarGroup>
            <SidebarMenu>
                <NavItem
                    path={orgPrefix.dashboard}
                    icon={<OrgDashboardIcon />}
                />
                <NavCollapsible
                    path={orgPrefix.admin.index}
                    icon={<ModuleIcons.Admin />}
                >
                    <Protect
                        permissions={{ d4hAccessToken: ["view"] }}
                        orgId={organization.id}
                    >
                        <NavSubItem path={orgPrefix.admin.d4hAccessTokens} />
                    </Protect>
                    <Protect
                        permissions={{ invitation: ["create"] }}
                        orgId={organization.id}
                    >
                        <NavSubItem path={orgPrefix.admin.invitations} />
                    </Protect>
                    <NavSubItem path={orgPrefix.admin.organization} />
                    <NavSubItem path={orgPrefix.admin.personnel} />
                    {/* <NavSubItem path={prefix.admin.skillPackages}/> */}
                    <NavSubItem path={orgPrefix.admin.teams} />
                    <Protect
                        permissions={{ member: ["create"] }}
                        orgId={organization.id}
                    >
                        <NavSubItem path={orgPrefix.admin.users} />
                    </Protect>
                </NavCollapsible>
                <Show when={modules["i3"].enabled}>
                    <NavCollapsible
                        path={orgPrefix.i3.index}
                        icon={<ModuleIcons.I3 />}
                    >
                        <NavSubItem path={orgPrefix.i3.templates} />
                    </NavCollapsible>
                </Show>
                <Show when={modules["d4h-views"].enabled}>
                    <NavCollapsible
                        path={orgPrefix.d4HViews.index}
                        icon={<ModuleIcons.D4HViews />}
                    >
                        {/* <NavItem path={orgPrefix.d4hViews.activities} />
                        <NavItem path={orgPrefix.d4hViews.calendar} /> */}
                        <NavItem path={orgPrefix.d4HViews.equipment.index} />
                        <NavItem path={orgPrefix.d4HViews.members} />
                    </NavCollapsible>
                </Show>
                {/* <Show when={isModuleEnabled(organization, "d4h-views")}>
                    <NavCollapsible
                        path={orgPrefix.d4hViews.index}
                        icon={<ModuleIcons.D4H />}
                    >
                        <NavItem path={orgPrefix.d4hViews.activities} />
                        <NavItem path={orgPrefix.d4hViews.calendar} />
                        <NavItem path={orgPrefix.d4hViews.equipment} />
                        <NavItem path={orgPrefix.d4hViews.personnel} />
                    </NavCollapsible>
                </Show> */}
                <Show when={modules.notes.enabled}>
                    <NavItem
                        path={orgPrefix.notes.index}
                        icon={<ModuleIcons.Notes />}
                    />
                </Show>
                <Show when={modules["skill-package-builder"].enabled}>
                    <NavItem
                        path={orgPrefix.skillPackageBuilder.index}
                        icon={<ModuleIcons.SkillPackageBuilder />}
                    />
                </Show>
                <Show when={modules.skills.enabled}>
                    <NavCollapsible
                        path={orgPrefix.skills.index}
                        icon={<ModuleIcons.Skills />}
                    >
                        <NavItem path={orgPrefix.skills.catalogue} />
                        <NavItem path={orgPrefix.skills.checks} />
                        <NavItem path={orgPrefix.skills.sessions} />
                        <NavItem path={orgPrefix.skills.reports} />
                    </NavCollapsible>
                </Show>
            </SidebarMenu>
        </SidebarGroup>
    );
}
