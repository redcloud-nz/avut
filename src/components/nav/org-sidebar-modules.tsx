/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Static sidebar for the org scope: every enabled module as its own `NavCollapsible` section,
 * shown together regardless of which module's page is current.
 *
 * Rendered by `orgs/[slug]/layout.tsx` (inside its real `OrganizationProvider`) and portalled
 * into the shared sidebar shell via `SidebarPortal` — not a `@sidebar` parallel route. That
 * mechanism turned out not to reliably invoke `@sidebar/orgs/[slug]/layout.tsx` for routes
 * nested below `/orgs/[slug]` once the per-module slot folders were removed, so `useOrganization`
 * calls there ran outside their provider (or the layout wasn't rendered at all). A portal from
 * the main route tree, which Next always invokes normally, sidesteps that entirely.
 *
 * `playground` is deliberately absent — it is an unregistered, org-scoped dev sandbox, not part
 * of the `Modules` registry or this sidebar.
 */

"use client";

import { ReactNode } from "react";

import { NavCollapsible, NavItem, NavSection } from "@/components/nav/nav-section";
import { Admin_Sidebar_Menu } from "@/components/admin/sidebar-menu";
import { D4HViews_Sidebar_Menu } from "@/components/d4h-views/sidebar-menu";
import { I3_Sidebar_Menu } from "@/components/i3/sidebar-menu";
import { SkillTrack_Sidebar_Menu } from "@/components/skill-track/sidebar-menu";

import { useOrganization } from "@/hooks/use-organization";
import { orgModules, type OrganizationModuleId } from "@/lib/modules";

/**
 * Sub-pages for a module's `NavCollapsible`, keyed by module id. A module absent here — a
 * single page with nothing to expand into, e.g. `notes` (no sidebar-menu component at all) or
 * `skill-package-builder` (its one destination is the module's own root, so a collapsible
 * around it would just repeat the parent link) — renders as a plain `NavItem` instead.
 */
const MODULE_SIDEBAR: Partial<Record<OrganizationModuleId, ReactNode>> = {
    "org-admin": <Admin_Sidebar_Menu />,
    "d4h-views": <D4HViews_Sidebar_Menu />,
    i3: <I3_Sidebar_Menu />,
    "skill-track": <SkillTrack_Sidebar_Menu />,
};

export function OrgSidebar_Modules() {
    const organization = useOrganization();

    return (
        <NavSection>
            {orgModules
                .filter((mod) => organization.isModuleEnabled(mod.id))
                .map((mod) => {
                    const Icon = mod.icon;
                    const href = mod.href(organization.slug);
                    const subItems = MODULE_SIDEBAR[mod.id];

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
