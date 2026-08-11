/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder
 */

import { SessionHydration } from "@/components/auth/session-hydration";
import { ModuleSidebar } from "@/components/nav/module-sidebar";

import { SkillPackageBuilder_Sidebar_Menu } from "./sidebar-menu";
import { requireOrganization } from "@/server/organization-access";

export const metadata = {
    title: "Skill Package Builder",
};

export default async function SkillPackageBuilder_Layout(
    props: LayoutProps<`/orgs/[slug]/skill-package-builder`>,
) {
    const { slug } = await props.params;
    const { settings } = await requireOrganization(slug);

    if (!settings.modules["skill-package-builder"].enabled) {
        throw new Error("Skill Package Builder module is not enabled for this organization.");
    }

    return (
        <SessionHydration>
            <ModuleSidebar scope="organization">
                <SkillPackageBuilder_Sidebar_Menu />
            </ModuleSidebar>
            {props.children}
        </SessionHydration>
    );
}
