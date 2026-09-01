/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { NavItem } from "@/components/nav/nav-section";
import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar";

/**
 * Site-wide admin sidebar.
 */
export function SystemAdmin_Sidebar_Menu() {
    return (
        <SidebarGroup>
            <SidebarMenu>
                <NavItem label="Organizations" href="/system-admin/organizations" />
                <NavItem label="Users" href="/system-admin/users" />
            </SidebarMenu>
        </SidebarGroup>
    );
}
