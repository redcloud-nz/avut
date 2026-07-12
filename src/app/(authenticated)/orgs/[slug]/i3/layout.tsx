/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/i3
 */

import { AppSidebar } from "@/components/nav/app-sidebar";

import { getOrganizationBySlug } from "@/server/organization";
import { getOrganizationSettings } from "@/server/organization-settings";

import { I3_Sidebar_Menu } from "./sidebar-menu";

export default async function I3_Layout(props: LayoutProps<"/orgs/[slug]/i3">) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    const settings = await getOrganizationSettings(organization.id);

    if (settings.modules["i3"].enabled === false)
        throw new Error("I3 module is not enabled for this organization.");

    return (
        <>
            <AppSidebar scope="organization">
                <I3_Sidebar_Menu />
            </AppSidebar>
            {props.children}
        </>
    );
}
