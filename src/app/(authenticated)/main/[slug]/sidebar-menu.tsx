/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Route } from "next";

import { ModuleIcons, OrgDashboardIcon } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { NavCollapsible, NavItem, NavSubItem } from "@/components/nav/nav-section";
import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar";

import { OrganizationData } from "@/lib/schemas/organization";

import { OrganizationSettings } from "@/lib/schemas/organization-settings";

export async function MainApp_Sidebar_Menu({
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
                <NavItem label="Dashboard" href={`/main/${slug}`} icon={<OrgDashboardIcon />} />
                <NavCollapsible
                    label="Admin"
                    href={`/main/${slug}/admin`}
                    icon={<ModuleIcons.Admin />}
                >
                    <Protect permissions={{ d4hAccessToken: ["view"] }} orgId={organization.id}>
                        <NavSubItem
                            label="D4H Access Tokens"
                            href={`/main/${slug}/admin/d4h-access-tokens`}
                        />
                    </Protect>
                    <Protect permissions={{ invitation: ["create"] }} orgId={organization.id}>
                        <NavSubItem label="Invitations" href={`/main/${slug}/admin/invitations`} />
                    </Protect>
                    <NavSubItem label="Organization" href={`/main/${slug}/admin/organization`} />
                    <NavSubItem label="Personnel" href={`/main/${slug}/admin/personnel`} />
                    <Protect permissions={{ organization: ["update"] }} orgId={organization.id}>
                        <NavSubItem
                            label="Organization Settings"
                            href={`/main/${slug}/admin/organization/settings`}
                        />
                    </Protect>
                    <NavSubItem label="Teams" href={`/main/${slug}/admin/teams`} />
                    <Protect permissions={{ member: ["create"] }} orgId={organization.id}>
                        <NavSubItem label="Users" href={`/main/${slug}/admin/users`} />
                    </Protect>
                </NavCollapsible>
                <Show when={modules["d4h-views"].enabled}>
                    <NavCollapsible
                        label="D4H Views"
                        href={`/main/${slug}/d4h-views`}
                        icon={<ModuleIcons.D4HViews />}
                    >
                        <NavSubItem label="Equipment" href={`/main/${slug}/d4h-views/equipment`} />
                        <NavSubItem label="Members" href={`/main/${slug}/d4h-views/members`} />
                    </NavCollapsible>
                </Show>
                <Show when={modules["i3"].enabled}>
                    <NavCollapsible label="I3" href={`/main/${slug}/i3`} icon={<ModuleIcons.I3 />}>
                        <Protect orgId={organization.id} permissions={{ i3Items: ["view"] }}>
                            <NavSubItem
                                label="By Equipment Kind"
                                href={`/main/${slug}/i3/kinds` as Route}
                            />
                        </Protect>
                        <Protect orgId={organization.id} permissions={{ i3Items: ["view"] }}>
                            <NavSubItem
                                label="By Member"
                                href={`/main/${slug}/i3/members` as Route}
                            />
                        </Protect>
                        <Protect orgId={organization.id} permissions={{ i3Items: ["inspect"] }}>
                            <NavSubItem
                                label="Inspect"
                                href={`/main/${slug}/i3/forms/inspect-items` as Route}
                            />
                        </Protect>
                        <Protect orgId={organization.id} permissions={{ i3Items: ["issue"] }}>
                            <NavSubItem
                                label="Issue"
                                href={`/main/${slug}/i3/forms/issue-items` as Route}
                            />
                        </Protect>

                        <Protect orgId={organization.id} permissions={{ i3Items: ["return"] }}>
                            <NavSubItem
                                label="Return"
                                href={`/main/${slug}/i3/forms/return-items` as Route}
                            />
                        </Protect>
                        <Protect orgId={organization.id} permissions={{ i3Template: ["view"] }}>
                            <NavSubItem label="Templates" href={`/main/${slug}/i3/templates`} />
                        </Protect>
                    </NavCollapsible>
                </Show>

                <Show when={modules.notes.enabled}>
                    <NavItem
                        label="Notes"
                        href={`/main/${slug}/notes`}
                        icon={<ModuleIcons.Notes />}
                    />
                </Show>
                <Show when={modules["skill-package-builder"].enabled}>
                    <NavItem
                        label="Skill Package Builder"
                        href={`/main/${slug}/skill-package-builder`}
                        icon={<ModuleIcons.SkillPackageBuilder />}
                    />
                </Show>
                <Show when={modules.skills.enabled}>
                    <NavCollapsible
                        label="Skills"
                        href={`/main/${slug}/skills`}
                        icon={<ModuleIcons.Skills />}
                    >
                        <NavSubItem label="Catalogue" href={`/main/${slug}/skills/catalogue`} />
                        <NavSubItem label="Checks" href={`/main/${slug}/skills/checks`} />
                        <NavSubItem label="Sessions" href={`/main/${slug}/skills/sessions`} />
                        <NavSubItem label="Reports" href={`/main/${slug}/skills/reports`} />
                    </NavCollapsible>
                </Show>
            </SidebarMenu>
        </SidebarGroup>
    );
}
