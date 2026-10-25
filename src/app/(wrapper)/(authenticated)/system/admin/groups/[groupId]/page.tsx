/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /system/admin/groups/[groupId]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { OrganizationGroupId } from "@/lib/schemas/organization-group";
import { SystemAdmin_Group_Content } from "@/modules/system-admin/components/groups/group-content";
import { requireSystemAdmin } from "@/server/system-admin-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/system/admin/groups/[groupId]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { groupId: raw } = await props.params;
    const groupId = OrganizationGroupId.schema.parse(raw);

    const group = await fetchQuery(trpc.organizationGroups.getGroup.queryOptions({ groupId }));

    return {
        title: `${group.name} ${TITLE_SEPARATOR} Groups`,
    };
}

export default async function SystemAdmin_Group_Page(props: Props) {
    await requireSystemAdmin();

    const { groupId: raw } = await props.params;
    const groupId = OrganizationGroupId.schema.parse(raw);

    prefetch(trpc.organizationGroups.getGroup.queryOptions({ groupId }));

    return (
        <HydrateClient>
            <SystemAdmin_Group_Content groupId={groupId} />
        </HydrateClient>
    );
}
