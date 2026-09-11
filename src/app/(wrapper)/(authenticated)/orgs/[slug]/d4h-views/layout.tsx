/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-views
 */

import { ModuleSidebar } from "@/components/nav/module-sidebar";

import { D4HViews_Sidebar_Menu } from "./sidebar-menu";
import { requireOrganization } from "@/server/organization-access";

export default async function D4HViews_Layout(props: LayoutProps<"/orgs/[slug]/d4h-views">) {
    const { slug } = await props.params;
    const { settings } = await requireOrganization(slug);

    if (settings.modules["d4h-views"].enabled === false)
        throw new Error("D4H Views module is not enabled for this organization.");

    return (
        <>
            <ModuleSidebar scope="organization">
                <D4HViews_Sidebar_Menu />
            </ModuleSidebar>
            {props.children}
        </>
    );
}
