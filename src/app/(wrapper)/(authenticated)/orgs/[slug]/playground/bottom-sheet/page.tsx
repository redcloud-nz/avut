/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/playground/bottom-sheet
 */

import { Std } from "@/components/blocks/std";

import { BottomSheet_Sandbox } from "./sandbox";

export default async function Playground_BottomSheet_Page() {
    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={["Playground", "Bottom sheet"]} />
            <Std.ScrollContainer>
                <BottomSheet_Sandbox />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
