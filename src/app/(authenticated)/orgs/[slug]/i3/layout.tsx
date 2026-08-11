/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/i3
 */

import { SessionHydration } from "@/components/auth/session-hydration";
import { ModuleSidebar } from "@/components/nav/module-sidebar";

import { I3_Sidebar_Menu } from "./sidebar-menu";
import { requireOrganization } from "@/server/organization-access";

export default async function I3_Layout(props: LayoutProps<"/orgs/[slug]/i3">) {
    const { slug } = await props.params;
    const { settings } = await requireOrganization(slug);

    if (settings.modules["i3"].enabled === false)
        throw new Error("I3 module is not enabled for this organization.");

    return (
        <SessionHydration>
            <ModuleSidebar scope="organization">
                <I3_Sidebar_Menu />
            </ModuleSidebar>
            {props.children}
        </SessionHydration>
    );
}
