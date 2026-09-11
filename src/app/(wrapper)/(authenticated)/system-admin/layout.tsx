/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /system-admin
 */

import { ModuleSidebar } from "@/components/nav/module-sidebar";

import { requireGlobalAdmin } from "@/server/system-admin-access";

import { SystemAdmin_Sidebar_Menu } from "./sidebar-menu";

export default async function SystemAdmin_Layout(props: LayoutProps<"/system-admin">) {
    await requireGlobalAdmin();

    return (
        <>
            <ModuleSidebar scope="global">
                <SystemAdmin_Sidebar_Menu />
            </ModuleSidebar>
            {props.children}
        </>
    );
}
