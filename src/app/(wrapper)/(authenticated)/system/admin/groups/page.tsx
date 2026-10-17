/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /system/admin/groups
 */

import { Std } from "@/components/blocks/std";
import { SystemAdmin_Groups_List } from "@/modules/system-admin/components/groups/groups-list";
import { requireSystemAdmin } from "@/server/system-admin-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Groups`,
};

export default async function SystemAdmin_Groups_Page() {
    await requireSystemAdmin();

    prefetch(trpc.organizationGroups.listGroups.queryOptions());

    return (
        <HydrateClient>
            <>
                <Std.Navbar
                    breadcrumbs={[
                        { label: "System Admin", href: "/system/admin" },
                        { label: "Groups", href: "/system/admin/groups" },
                    ]}
                />
                <Std.ScrollContainer>
                    <SystemAdmin_Groups_List />
                </Std.ScrollContainer>
            </>
        </HydrateClient>
    );
}
