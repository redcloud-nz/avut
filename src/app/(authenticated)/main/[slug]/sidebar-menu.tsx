/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { getTranslations } from "next-intl/server";

import { ModuleIcons, OrgDashboardIcon } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import { NavCollapsible, NavItem, NavSubItem } from "@/components/nav/nav-section";
import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar";

import { OrganizationData } from "@/lib/schemas/organization";

import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { Route } from "next";

export async function MainApp_Sidebar_Menu({
    organization,
    settings,
}: {
    organization: OrganizationData;
    settings: OrganizationSettings;
}) {
    const t = await getTranslations("SidebarMenu");

    const { slug } = organization;
    const { modules } = settings;

    return (
        <SidebarGroup>
            <SidebarMenu>
                <NavItem
                    label={t("dashboard")}
                    href={`/main/${slug}`}
                    icon={<OrgDashboardIcon />}
                />
                <NavCollapsible
                    label={t("admin.sectionTitle")}
                    href={`/main/${slug}/admin`}
                    icon={<ModuleIcons.Admin />}
                >
                    <Protect permissions={{ d4hAccessToken: ["view"] }} orgId={organization.id}>
                        <NavSubItem
                            label={t("admin.d4hAccessTokens")}
                            href={`/main/${slug}/admin/d4h-access-tokens`}
                        />
                    </Protect>
                    <Protect permissions={{ invitation: ["create"] }} orgId={organization.id}>
                        <NavSubItem
                            label={t("admin.invitations")}
                            href={`/main/${slug}/admin/invitations`}
                        />
                    </Protect>
                    <NavSubItem
                        label={t("admin.organization")}
                        href={`/main/${slug}/admin/organization`}
                    />
                    <NavSubItem
                        label={t("admin.personnel")}
                        href={`/main/${slug}/admin/personnel`}
                    />
                    <Protect permissions={{ organization: ["update"] }} orgId={organization.id}>
                        <NavSubItem
                            label={t("admin.organizationSettings")}
                            href={`/main/${slug}/admin/organization/settings`}
                        />
                    </Protect>
                    <NavSubItem label={t("admin.teams")} href={`/main/${slug}/admin/teams`} />
                    <Protect permissions={{ member: ["create"] }} orgId={organization.id}>
                        <NavSubItem label={t("admin.users")} href={`/main/${slug}/admin/users`} />
                    </Protect>
                </NavCollapsible>
                <Show when={modules["d4h-views"].enabled}>
                    <NavCollapsible
                        label={t("d4hViews.sectionTitle")}
                        href={`/main/${slug}/d4h-views`}
                        icon={<ModuleIcons.D4HViews />}
                    >
                        <NavSubItem
                            label={t("d4hViews.equipment")}
                            href={`/main/${slug}/d4h-views/equipment`}
                        />
                        <NavSubItem
                            label={t("d4hViews.members")}
                            href={`/main/${slug}/d4h-views/members`}
                        />
                    </NavCollapsible>
                </Show>
                <Show when={modules["i3"].enabled}>
                    <NavCollapsible
                        label={t("i3.sectionTitle")}
                        href={`/main/${slug}/i3`}
                        icon={<ModuleIcons.I3 />}
                    >
                        <Protect orgId={organization.id} permissions={{ i3Items: ["inspect"] }}>
                            <NavSubItem
                                label={t("i3.inspect")}
                                href={`/main/${slug}/i3/forms/inspect-items` as Route}
                            />
                        </Protect>
                        <Protect orgId={organization.id} permissions={{ i3Items: ["issue"] }}>
                            <NavSubItem
                                label={t("i3.issue")}
                                href={`/main/${slug}/i3/forms/issue-items` as Route}
                            />
                        </Protect>
                        <Protect orgId={organization.id} permissions={{ i3Items: ["view"] }}>
                            <NavSubItem
                                label={t("i3.members")}
                                href={`/main/${slug}/i3/members` as Route}
                            />
                        </Protect>
                        <Protect orgId={organization.id} permissions={{ i3Items: ["return"] }}>
                            <NavSubItem
                                label={t("i3.return")}
                                href={`/main/${slug}/i3/forms/return-items` as Route}
                            />
                        </Protect>
                        <Protect orgId={organization.id} permissions={{ i3Template: ["view"] }}>
                            <NavSubItem
                                label={t("i3.templates")}
                                href={`/main/${slug}/i3/templates`}
                            />
                        </Protect>
                    </NavCollapsible>
                </Show>

                <Show when={modules.notes.enabled}>
                    <NavItem
                        label={t("notes.sectionTitle")}
                        href={`/main/${slug}/notes`}
                        icon={<ModuleIcons.Notes />}
                    />
                </Show>
                <Show when={modules["skill-package-builder"].enabled}>
                    <NavItem
                        label={t("skillPackageBuilder.sectionTitle")}
                        href={`/main/${slug}/skill-package-builder`}
                        icon={<ModuleIcons.SkillPackageBuilder />}
                    />
                </Show>
                <Show when={modules.skills.enabled}>
                    <NavCollapsible
                        label={t("skills.sectionTitle")}
                        href={`/main/${slug}/skills`}
                        icon={<ModuleIcons.Skills />}
                    >
                        <NavSubItem
                            label={t("skills.catalogue")}
                            href={`/main/${slug}/skills/catalogue`}
                        />
                        <NavSubItem
                            label={t("skills.checks")}
                            href={`/main/${slug}/skills/checks`}
                        />
                        <NavSubItem
                            label={t("skills.sessions")}
                            href={`/main/${slug}/skills/sessions`}
                        />
                        <NavSubItem
                            label={t("skills.reports")}
                            href={`/main/${slug}/skills/reports`}
                        />
                    </NavCollapsible>
                </Show>
            </SidebarMenu>
        </SidebarGroup>
    );
}
