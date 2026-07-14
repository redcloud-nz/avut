/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/i3
 */

import { ModuleSidebar } from "@/components/nav/module-sidebar";

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
            <ModuleSidebar scope="organization">
                <I3_Sidebar_Menu />
            </ModuleSidebar>
            {props.children}
        </>
    );
}
