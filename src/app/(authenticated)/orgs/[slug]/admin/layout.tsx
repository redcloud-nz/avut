/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin
 */

import { AppSidebar } from "@/components/nav/app-sidebar";

import { Admin_Sidebar_Menu } from "./sidebar-menu";

export default async function Admin_Layout(props: LayoutProps<"/orgs/[slug]/admin">) {
    return (
        <>
            <AppSidebar scope="organization">
                <Admin_Sidebar_Menu />
            </AppSidebar>
            {props.children}
        </>
    );
}
