/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/admin/scripts
 */

import { Std } from "@/components/blocks/std";

export default async function AdminScripts_Page() {
    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={["Admin", "Scripts"]} />
            <Std.ScrollContainer>
                <Std.IndexPage title="Admin Scripts" />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
