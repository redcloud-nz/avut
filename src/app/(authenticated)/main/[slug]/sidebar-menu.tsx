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
                <NavItem
                    label="Dashboard"
                    href={route("/main/[slug]", { slug })}
                    icon={<OrgDashboardIcon />}
                />
                <NavCollapsible
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
                </NavCollapsible>
                <Show when={modules["d4h-views"].enabled}>
                    <NavCollapsible
                        label="D4H Views"
                        href={route("/main/[slug]/d4h-views", { slug })}
                        icon={<ModuleIcons.D4HViews />}
                    >
                        <NavSubItem
                            label="Equipment"
                            href={route("/main/[slug]/d4h-views/equipment", { slug })}
                        />
                        <NavSubItem
                            label="Members"
                            href={route("/main/[slug]/d4h-views/members", { slug })}
                        />
                    </NavCollapsible>
                </Show>
                <Show when={modules["i3"].enabled}>
                    <NavCollapsible
                        label="I3"
                        href={route("/main/[slug]/i3", { slug })}
                        icon={<ModuleIcons.I3 />}
                    >
                        <Protect orgId={organization.id} permissions={{ i3Item: ["view"] }}>
                            <NavSubItem
                                label="By Equipment Kind"
                                href={route("/main/[slug]/i3/equipment-kinds", { slug })}
                            />
                        </Protect>
                        <Protect orgId={organization.id} permissions={{ i3Item: ["view"] }}>
                            <NavSubItem
                                label="By Member"
                                href={route("/main/[slug]/i3/members", { slug })}
                            />
                        </Protect>
                        <Protect orgId={organization.id} permissions={{ i3Item: ["inspect"] }}>
                            <NavSubItem
                                label="Inspect"
                                href={route("/main/[slug]/i3/inspect", { slug })}
                            />
                        </Protect>
                        <Protect orgId={organization.id} permissions={{ i3Item: ["issue"] }}>
                            <NavSubItem
                                label="Issue"
                                href={route("/main/[slug]/i3/forms/issue-items", { slug })}
                            />
                        </Protect>

                        <Protect orgId={organization.id} permissions={{ i3Item: ["return"] }}>
                            <NavSubItem
                                label="Return"
                                href={route("/main/[slug]/i3/forms/return-items", { slug })}
                            />
                        </Protect>
                        <Protect orgId={organization.id} permissions={{ i3Template: ["view"] }}>
                            <NavSubItem
                                label="Templates"
                                href={route("/main/[slug]/i3/templates", { slug })}
                            />
                        </Protect>
                    </NavCollapsible>
                </Show>

                <Show when={modules.notes.enabled}>
                    <NavItem
                        label="Notes"
                        href={route("/main/[slug]/notes", { slug })}
                        icon={<ModuleIcons.Notes />}
                    />
                </Show>
                <Show when={modules["skill-package-builder"].enabled}>
                    <NavItem
                        label="Skill Package Builder"
                        href={route("/main/[slug]/skill-package-builder", { slug })}
                        icon={<ModuleIcons.SkillPackageBuilder />}
                    />
                </Show>
            </SidebarMenu>
        </SidebarGroup>
    );
}
