/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /system-admin/users/[user_id]
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { SystemAdmin_User_Content } from "@/components/system-admin/users/user-content";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { UserId } from "@/lib/schemas/user";
import { requireGlobalAdmin } from "@/server/system-admin-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/system-admin/users/[user_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    await requireGlobalAdmin();

    const { user_id } = await props.params;
    const userId = UserId.schema.parse(user_id);

    const user = await fetchQuery(trpc.systemAdmin.getUser.queryOptions({ userId }));

    return {
        title: `${user.name} ${TITLE_SEPARATOR} Users`,
    };
}

export default async function SystemAdmin_User_Page(props: Props) {
    await requireGlobalAdmin();

    const { user_id } = await props.params;
    const userId = UserId.schema.parse(user_id);

    prefetch(trpc.systemAdmin.getUser.queryOptions({ userId }));

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <SystemAdmin_User_Content userId={userId} />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
