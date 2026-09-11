/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/playground
 */

import { notFound } from "next/navigation";

import { ModuleSidebar } from "@/components/nav/module-sidebar";

import { playgroundFlag } from "@/lib/flags";
import { requireOrganization } from "@/server/organization-access";

import { Playground_Sidebar_Menu } from "./sidebar-menu";

export const metadata = {
    title: "Playground",
};

export default async function Playground_Layout(props: LayoutProps<"/orgs/[slug]/playground">) {
    const { slug } = await props.params;
    await requireOrganization(slug);

    // Flag-only gate — not a settings-gated module, so there is no
    // `settings.modules.*.enabled` check. When the flag is on, any signed-in org
    // member can reach the playground; individual pages add their own <Protect>
    // if they need to render something a plain member shouldn't.
    if (!(await playgroundFlag())) notFound();

    return (
        <>
            <ModuleSidebar scope="organization">
                <Playground_Sidebar_Menu />
            </ModuleSidebar>
            {props.children}
        </>
    );
}
