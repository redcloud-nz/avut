/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track
 */

import { ModuleSidebar } from "@/components/nav/module-sidebar";

import { SkillTrack_Sidebar_Menu } from "./sidebar-menu";

export default async function SkillTrack_Layout(props: LayoutProps<"/orgs/[slug]/skill-track">) {
    const { slug } = await props.params;

    return (
        <>
            <ModuleSidebar scope="organization">
                <SkillTrack_Sidebar_Menu />
            </ModuleSidebar>
            {props.children}
        </>
    );
}
