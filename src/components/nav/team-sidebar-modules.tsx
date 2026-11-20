/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Static sidebar for the team scope (`/teams/[slug]`): a hardcoded Dashboard item for the scope
 * root, then every enabled module that lives in team scope (`teamModules`), each as its own
 * `NavCollapsible` section when it has sub-pages.
 *
 * Rendered by `teams/[slug]/layout.tsx` (inside its `OrganizationProvider` and `TeamProvider`)
 * and portalled into the shared sidebar shell via `SidebarPortal`, as `org-sidebar-modules.tsx`
 * is from the org layout. A module that isn't `alwaysOn` is enabled by its org settings key, for
 * the team's org.
 */

"use client";

import { LayoutDashboardIcon } from "lucide-react";
import { ReactNode } from "react";

import { NavCollapsible, NavItem, NavSection } from "@/components/nav/nav-section";
import { useOrganization } from "@/hooks/use-organization";
import { useTeamSlug } from "@/hooks/use-team";
import { teamModules, type TeamScopedModule } from "@/lib/modules";
import { route } from "@/lib/routes";
import { TeamAdmin_Sidebar_Menu } from "@/modules/team-admin/components/sidebar-menu";

/**
 * Sub-pages for a team-scope module's `NavCollapsible`, keyed by module id. A module absent here
 * renders as a plain `NavItem`.
 */
const TEAM_MODULE_SIDEBAR: Partial<Record<TeamScopedModule["id"], ReactNode>> = {
    "team-admin": <TeamAdmin_Sidebar_Menu />,
};

export function TeamSidebar_Modules() {
    const organization = useOrganization();
    const teamSlug = useTeamSlug();

    return (
        <NavSection>
            <NavItem
                icon={<LayoutDashboardIcon />}
                label="Dashboard"
                href={route("/teams/[slug]", { slug: teamSlug })}
            />
            {teamModules
                .filter((mod) => mod.alwaysOn || organization.isModuleEnabled(mod.id))
                .map((mod) => {
                    const Icon = mod.icon;
                    const href = mod.href(teamSlug);
                    const subItems = TEAM_MODULE_SIDEBAR[mod.id];

                    if (!subItems) {
                        return (
                            <NavItem key={mod.id} icon={<Icon />} label={mod.label} href={href} />
                        );
                    }

                    return (
                        <NavCollapsible key={mod.id} icon={<Icon />} label={mod.label} href={href}>
                            {subItems}
                        </NavCollapsible>
                    );
                })}
        </NavSection>
    );
}
