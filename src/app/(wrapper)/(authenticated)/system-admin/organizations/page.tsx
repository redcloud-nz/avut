/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /system-admin/organizations
 */

import { Std } from "@/components/blocks/std";
import { SystemAdmin_Organizations_List } from "@/components/system-admin/organizations/organizations-list";

import { requireGlobalAdmin } from "@/server/system-admin-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Organizations`,
};

export default async function SystemAdmin_Organizations_Page() {
    await requireGlobalAdmin();

    prefetch(trpc.systemAdmin.listOrganizations.queryOptions());

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <Std.Navbar
                    breadcrumbs={[
                        { label: "System Admin", href: "/system-admin" },
                        { label: "Organizations", href: "/system-admin/organizations" },
                    ]}
                />
                <Std.ScrollContainer>
                    <SystemAdmin_Organizations_List />
                </Std.ScrollContainer>
            </Std.SidebarInset>
        </HydrateClient>
    );
}
