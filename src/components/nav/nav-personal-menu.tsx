/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { InvitationsIcon, PersonalDashboardIcon } from "@/components/icons";
import { SidebarGroup, SidebarMenu } from "@/components/ui/sidebar";

import * as Paths from "@/paths";

import { NavItem, NavSubItem } from "./nav-section";

export function NavPersonalMenu({}) {
    return (
        <SidebarGroup>
            <SidebarMenu>
                <NavItem
                    path={Paths.personal.dashboard}
                    icon={<PersonalDashboardIcon />}
                />
                <NavSubItem
                    path={Paths.personal.invitations}
                    icon={<InvitationsIcon />}
                />
            </SidebarMenu>
        </SidebarGroup>
    );
}
