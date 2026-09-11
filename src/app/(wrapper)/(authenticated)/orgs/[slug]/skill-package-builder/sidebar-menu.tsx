/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { NavItem } from "@/components/nav/nav-section";
import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar";

import { route } from "@/lib/routes";

import { useOrganization } from "@/hooks/use-organization";

export function SkillPackageBuilder_Sidebar_Menu() {
    const { slug } = useOrganization();

    return (
        <SidebarGroup>
            <SidebarMenu>
                <NavItem
                    label="Skill Packages"
                    href={route("/orgs/[slug]/skill-package-builder", { slug })}
                />
            </SidebarMenu>
        </SidebarGroup>
    );
}
