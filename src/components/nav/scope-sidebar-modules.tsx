/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Static sidebar content for the user and system scopes — unlike org modules, these aren't
 * gated by any per-org settings or flags, so there's nothing to fetch and no provider needed:
 * just render by path. The org scope's module list is rendered separately, via `SidebarPortal`
 * from `orgs/[slug]/layout.tsx` — see `org-sidebar-modules.tsx` for why.
 */

"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";

import { NavCollapsible, NavItem, NavSection } from "@/components/nav/nav-section";
import { SystemAdmin_Sidebar_Menu } from "@/components/system-admin/sidebar-menu";
import { Profile_Sidebar_Menu } from "@/components/user/profile-sidebar-menu";
import { systemModules, userModules, type UserModuleId } from "@/lib/modules";

/** Sub-pages for a user module's `NavCollapsible`, keyed by module id — same idea as the org
 *  scope's `MODULE_SIDEBAR` in `org-sidebar-modules.tsx`. */
const USER_MODULE_SIDEBAR: Partial<Record<UserModuleId, ReactNode>> = {
    profile: <Profile_Sidebar_Menu />,
};

export function ScopeSidebar_Modules() {
    const pathname = usePathname();

    if (pathname === "/user" || pathname.startsWith("/user/")) {
        return (
            <NavSection>
                {userModules.map((mod) => {
                    const Icon = mod.icon;
                    const subItems = USER_MODULE_SIDEBAR[mod.id];

                    if (!subItems) {
                        return (
                            <NavItem
                                key={mod.id}
                                icon={<Icon />}
                                label={mod.label}
                                href={mod.href()}
                            />
                        );
                    }

                    return (
                        <NavCollapsible
                            key={mod.id}
                            icon={<Icon />}
                            label={mod.label}
                            href={mod.href()}
                        >
                            {subItems}
                        </NavCollapsible>
                    );
                })}
            </NavSection>
        );
    }

    if (pathname === "/system" || pathname.startsWith("/system/")) {
        return (
            <NavSection>
                {systemModules.map((mod) => {
                    const Icon = mod.icon;
                    return (
                        <NavCollapsible
                            key={mod.id}
                            icon={<Icon />}
                            label={mod.label}
                            href={mod.href()}
                        >
                            <SystemAdmin_Sidebar_Menu />
                        </NavCollapsible>
                    );
                })}
            </NavSection>
        );
    }

    return null;
}
