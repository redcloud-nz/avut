/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    AdminModuleIcon,
    D4HModuleIcon,
    OrgDashboardIcon,
    NotesModuleIcon,
    SkillsModuleIcon,
    SkillPackageManagerModuleIcon,
} from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar";

import { isModuleEnabled } from "@/lib/modules";
import { OrganizationWithSettings } from "@/lib/schemas/organization";
import * as Paths from "@/paths";

import { NavCollapsible, NavItem, NavSubItem } from "./nav-section";

export function NavOrganizationMenu({
    organization,
}: {
    organization: OrganizationWithSettings;
}) {
    const orgPrefix = Paths.org(organization.slug);

    return (
        <SidebarGroup>
            <SidebarMenu>
                <NavItem
                    path={orgPrefix.dashboard}
                    icon={<OrgDashboardIcon />}
                />
                <NavCollapsible
                    path={orgPrefix.admin.index}
                    icon={<AdminModuleIcon />}
                >
                    <Protect
                        permissions={{ invitation: ["create"] }}
                        orgId={organization.id}
                    >
                        <NavSubItem path={orgPrefix.admin.invitations} />
                    </Protect>
                    <NavSubItem path={orgPrefix.admin.profile} />
                    <NavSubItem path={orgPrefix.admin.personnel} />
                    <NavSubItem path={orgPrefix.admin.settings} />
                    {/* <NavSubItem path={prefix.admin.skillPackages}/> */}
                    <NavSubItem path={orgPrefix.admin.teams} />
                    <Protect
                        permissions={{ member: ["create"] }}
                        orgId={organization.id}
                    >
                        <NavSubItem path={orgPrefix.admin.users} />
                    </Protect>
                </NavCollapsible>
                <Show when={isModuleEnabled(organization, "d4h-views")}>
                    <NavCollapsible
                        path={orgPrefix.d4hViews.index}
                        icon={<D4HModuleIcon />}
                    >
                        <NavItem path={orgPrefix.d4hViews.activities} />
                        <NavItem path={orgPrefix.d4hViews.calendar} />
                        <NavItem path={orgPrefix.d4hViews.equipment} />
                        <NavItem path={orgPrefix.d4hViews.personnel} />
                    </NavCollapsible>
                </Show>
                <Show when={isModuleEnabled(organization, "notes")}>
                    <NavItem
                        path={orgPrefix.notes.index}
                        icon={<NotesModuleIcon />}
                    />
                </Show>
                <Show
                    when={isModuleEnabled(
                        organization,
                        "skill-package-manager",
                    )}
                >
                    <NavCollapsible
                        path={orgPrefix.skillPackageManager.index}
                        icon={<SkillPackageManagerModuleIcon />}
                    >
                        <NavItem
                            path={orgPrefix.skillPackageManager.skillPackages}
                        />
                    </NavCollapsible>
                </Show>
                <Show when={isModuleEnabled(organization, "skills")}>
                    <NavCollapsible
                        path={orgPrefix.skills.index}
                        icon={<SkillsModuleIcon />}
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
