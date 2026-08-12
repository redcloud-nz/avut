/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin
 */

import { ModuleSidebar } from "@/components/nav/module-sidebar";

import { requireOrganization } from "@/server/organization-access";

import { Admin_Sidebar_Menu } from "./sidebar-menu";

export default async function Admin_Layout(props: LayoutProps<"/orgs/[slug]/admin">) {
    const { slug } = await props.params;
    await requireOrganization(slug);

    return (
        <>
            <ModuleSidebar scope="organization">
                <Admin_Sidebar_Menu />
            </ModuleSidebar>
            {props.children}
        </>
    );
}
