/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /system-admin/users
 */

import { Std } from "@/components/blocks/std";
import { SystemAdmin_Users_List } from "@/components/system-admin/users/users-list";

import { requireGlobalAdmin } from "@/server/system-admin-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Users`,
};

export default async function SystemAdmin_Users_Page() {
    await requireGlobalAdmin();

    prefetch(trpc.systemAdmin.listUsers.queryOptions());

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <Std.Navbar
                    breadcrumbs={[
                        { label: "System Admin", href: "/system-admin" },
                        { label: "Users", href: "/system-admin/users" },
                    ]}
                />
                <Std.ScrollContainer>
                    <SystemAdmin_Users_List />
                </Std.ScrollContainer>
            </Std.SidebarInset>
        </HydrateClient>
    );
}
