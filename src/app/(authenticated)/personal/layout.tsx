/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /personal
 */

import { AppSidebar } from "@/components/nav/app-sidebar";
import { ControlBar } from "@/components/nav/control-bar";
import { NavPersonalMenu } from "@/components/nav/nav-personal-menu";

export default async function Personal_Layout(props: LayoutProps<"/personal">) {
    return (
        <>
            <AppSidebar name="Personal">
                <NavPersonalMenu />
            </AppSidebar>
            <ControlBar />
            {props.children}
        </>
    );
}
