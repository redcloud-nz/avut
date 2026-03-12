/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { getTranslations } from "next-intl/server";

import { ModuleIcons, OrgDashboardIcon } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Show } from "@/components/show";
import {
    NavCollapsible,
    NavItem,
    NavSubItem,
} from "@/components/nav/nav-section";
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
    const t = await getTranslations("MainApp");

    const { slug } = organization;
    const { modules } = settings;

    return (
        <SidebarGroup>
            <SidebarMenu>
                <NavItem
                    label={t("Index_Page.title")}
                    href={`/main/${slug}`}
                    icon={<OrgDashboardIcon />}
                />
                <NavCollapsible
                    label={t("AdminModule.title")}
                    href={`/main/${slug}/admin`}
                    icon={<ModuleIcons.Admin />}
                >
                    <Protect
                        permissions={{ d4hAccessToken: ["view"] }}
                        orgId={organization.id}
                    >
                        <NavSubItem
                            label={t("AdminModule.d4hAccessTokens")}
                            href={`/main/${slug}/admin/d4h-access-tokens`}
                        />
                    </Protect>
                    <Protect
                        permissions={{ invitation: ["create"] }}
                        orgId={organization.id}
                    >
                        <NavSubItem
                            label={t("AdminModule.invitations")}
                            href={`/main/${slug}/admin/invitations`}
                        />
                    </Protect>
                    <NavSubItem
                        label={t("AdminModule.organization")}
                        href={`/main/${slug}/admin/organization`}
                    />
                    <NavSubItem
                        label={t("AdminModule.personnel")}
                        href={`/main/${slug}/admin/personnel`}
                    />
                    <Protect
                        permissions={{ organization: ["update"] }}
                        orgId={organization.id}
                    >
                        <NavSubItem
                            label={t("AdminModule.organizationSettings")}
                            href={`/main/${slug}/admin/organization/settings`}
                        />
                    </Protect>
                    <NavSubItem
                        label={t("AdminModule.teams")}
                        href={`/main/${slug}/admin/teams`}
                    />
                    <Protect
                        permissions={{ member: ["create"] }}
                        orgId={organization.id}
                    >
                        <NavSubItem
                            label={t("AdminModule.users")}
                            href={`/main/${slug}/admin/users`}
                        />
                    </Protect>
                </NavCollapsible>
                <Show when={modules["d4h-views"].enabled}>
                    <NavCollapsible
                        label={t("D4HViewsModule.title")}
                        href={`/main/${slug}/d4h-views`}
                        icon={<ModuleIcons.D4HViews />}
                    >
                        <NavSubItem
                            label={t("D4HViewsModule.equipment")}
                            href={`/main/${slug}/d4h-views/equipment`}
                        />
                        <NavSubItem
                            label={t("D4HViewsModule.members")}
                            href={`/main/${slug}/d4h-views/members`}
                        />
                    </NavCollapsible>
                </Show>
                <Show when={modules["i3"].enabled}>
                    <NavCollapsible
                        label={t("I3Module.title")}
                        href={`/main/${slug}/i3`}
                        icon={<ModuleIcons.I3 />}
                    >
                        <NavSubItem
                            label={t("I3Module.templates")}
                            href={`/main/${slug}/i3/templates`}
                        />
                    </NavCollapsible>
                </Show>

                <Show when={modules.notes.enabled}>
                    <NavItem
                        label={t("NotesModule.title")}
                        href={`/main/${slug}/notes`}
                        icon={<ModuleIcons.Notes />}
                    />
                </Show>
                <Show when={modules["skill-package-builder"].enabled}>
                    <NavItem
                        label={t("SkillPackageBuilderModule.title")}
                        href={`/main/${slug}/skill-package-builder`}
                        icon={<ModuleIcons.SkillPackageBuilder />}
                    />
                </Show>
                <Show when={modules.skills.enabled}>
                    <NavCollapsible
                        label={t("SkillsModule.title")}
                        href={`/main/${slug}/skills`}
                        icon={<ModuleIcons.Skills />}
                    >
                        <NavSubItem
                            label={t("SkillsModule.catalogue")}
                            href={`/main/${slug}/skills/catalogue`}
                        />
                        <NavSubItem
                            label={t("SkillsModule.checks")}
                            href={`/main/${slug}/skills/checks`}
                        />
                        <NavSubItem
                            label={t("SkillsModule.sessions")}
                            href={`/main/${slug}/skills/sessions`}
                        />
                        <NavSubItem
                            label={t("SkillsModule.reports")}
                            href={`/main/${slug}/skills/reports`}
                        />
                    </NavCollapsible>
                </Show>
            </SidebarMenu>
        </SidebarGroup>
    );
}
