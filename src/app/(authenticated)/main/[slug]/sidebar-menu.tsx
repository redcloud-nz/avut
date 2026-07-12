/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { ModuleIcons, OrgDashboardIcon } from "@/components/icons";
import { Show } from "@/components/show";
import { NavItem } from "@/components/nav/nav-section";
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
                <Show when={modules.notes.enabled}>
                    <NavItem
                        label="Notes"
                        href={route("/main/[slug]/notes", { slug })}
                        icon={<ModuleIcons.Notes />}
                    />
                </Show>
            </SidebarMenu>
        </SidebarGroup>
    );
}
