/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /system/admin/rubbish-bin
 */

import { Std } from "@/components/blocks/std";
import { SystemAdmin_RubbishBin_List } from "@/components/system/admin/rubbish-bin-list";
import { requireSystemAdmin } from "@/server/system-admin-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Rubbish`,
};

export default async function SystemAdmin_RubbishBin_Page() {
    await requireSystemAdmin();

    prefetch(trpc.systemAdmin.listDeletedUsers.queryOptions());

    return (
        <HydrateClient>
            <>
                <Std.Navbar
                    breadcrumbs={[
                        { label: "System Admin", href: "/system/admin" },
                        { label: "Rubbish", href: "/system/admin/rubbish-bin" },
                    ]}
                />
                <Std.ScrollContainer>
                    <SystemAdmin_RubbishBin_List />
                </Std.ScrollContainer>
            </>
        </HydrateClient>
    );
}
