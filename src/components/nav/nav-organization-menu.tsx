/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Protect } from "@clerk/nextjs";

import { Show } from "@/components/show";
import {
    AdminModuleIcon,
    D4HModuleIcon,
    OrgDashboardIcon,
    NotesModuleIcon,
    SkillsModuleIcon,
    SkillPackageManagerModuleIcon,
} from "@/components/icons";
import { S2_SidebarGroup, S2_SidebarMenu } from "@/components/ui/s2-sidebar";

import { useOrganization } from "@/hooks/use-organization";
import { isModuleEnabled } from "@/lib/modules";
import * as Paths from "@/paths";

import { NavCollapsible, NavItem, NavSubItem } from "./nav-section";

export function NavOrganizationMenu() {
    const organization = useOrganization();

    const orgPrefix = Paths.org(organization.slug);

    return (
        <S2_SidebarGroup>
            <S2_SidebarMenu>
                <NavItem
                    path={orgPrefix.dashboard}
                    icon={<OrgDashboardIcon />}
                />
                <NavCollapsible
                    path={orgPrefix.admin}
                    icon={<AdminModuleIcon />}
                    prefix={orgPrefix.admin.href}
                >
                    <Protect role="org:admin">
                        <NavSubItem path={orgPrefix.admin.invitations} />
                    </Protect>
                    <NavSubItem path={orgPrefix.admin.profile} />
                    <NavSubItem path={orgPrefix.admin.personnel} />
                    <NavSubItem path={orgPrefix.admin.settings} />
                    {/* <NavSubItem path={prefix.admin.skillPackages}/> */}
                    <NavSubItem path={orgPrefix.admin.teams} />
                    <Protect role="org:admin">
                        <NavSubItem path={orgPrefix.admin.users} />
                    </Protect>
                </NavCollapsible>
                <Show when={isModuleEnabled(organization, "d4h-views")}>
                    <NavCollapsible
                        path={orgPrefix.d4hViews}
                        icon={<D4HModuleIcon />}
                        prefix={orgPrefix.d4hViews.href}
                    >
                        <NavItem path={orgPrefix.d4hViews.activities} />
                        <NavItem path={orgPrefix.d4hViews.calendar} />
                        <NavItem path={orgPrefix.d4hViews.equipment} />
                        <NavItem path={orgPrefix.d4hViews.personnel} />
                    </NavCollapsible>
                </Show>
                <Show when={isModuleEnabled(organization, "notes")}>
                    <NavItem
                        path={orgPrefix.notes}
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
                        path={orgPrefix.skillPackageManager}
                        icon={<SkillPackageManagerModuleIcon />}
                        prefix={orgPrefix.skillPackageManager.href}
                    >
                        <NavItem
                            path={orgPrefix.skillPackageManager.skillPackages}
                        />
                    </NavCollapsible>
                </Show>
                <Show when={isModuleEnabled(organization, "skills")}>
                    <NavCollapsible
                        path={orgPrefix.skills}
                        icon={<SkillsModuleIcon />}
                        prefix={orgPrefix.skills.href}
                    >
                        <NavItem path={orgPrefix.skills.catalogue} />
                        <NavItem path={orgPrefix.skills.checks} />
                        <NavItem path={orgPrefix.skills.sessions} />
                        <NavItem path={orgPrefix.skills.reports} />
                    </NavCollapsible>
                </Show>
            </S2_SidebarMenu>
        </S2_SidebarGroup>
    );
}
