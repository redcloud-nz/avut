/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /system-admin
 */

import { Std } from "@/components/blocks/std";

import { requireGlobalAdmin } from "@/server/system-admin-access";

export default async function SystemAdmin_Index_Page() {
    await requireGlobalAdmin();

    return (
        <Std.SidebarInset>
            <Std.Navbar breadcrumbs={["System Admin"]} />
            <Std.ScrollContainer>
                <Std.IndexPage title="System Admin">
                    <p className="text-sm text-muted-foreground text-center">
                        Site-wide administration. Users and organizations tools arrive in a later
                        phase.
                    </p>
                </Std.IndexPage>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
