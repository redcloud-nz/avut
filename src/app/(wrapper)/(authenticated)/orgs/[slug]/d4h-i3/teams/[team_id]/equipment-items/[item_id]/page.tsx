/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h-i3/teams/[team_id]/equipment-items/[item_id]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { D4HI3Module_EquipmentItem_Content } from "@/modules/d4h-i3/components/equipment-item/equipment-item-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/d4h-i3/teams/[team_id]/equipment-items/[item_id]">;

function parseIds(team_id: string, item_id: string) {
    const teamId = Number(team_id);
    const itemId = Number(item_id);
    if (!Number.isInteger(teamId) || !Number.isInteger(itemId)) notFound();
    return { teamId, itemId };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, team_id, item_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return {};
    const organization = await getOrganizationBySlug(slug);

    const { teamId, itemId } = parseIds(team_id, item_id);

    try {
        const { item } = await fetchQuery(
            trpc.d4hApi.getEquipmentItem.queryOptions({
                organizationId: organization.id,
                teamId,
                itemId,
            }),
        );
        return { title: `Item #${item.ref} ${TITLE_SEPARATOR} D4H I3` };
    } catch (error) {
        // No D4H token: keep a usable title, and let the page's error boundary explain.
        if (error instanceof TRPCError && error.code === "PRECONDITION_FAILED") {
            return { title: `Item #${item_id} ${TITLE_SEPARATOR} D4H I3` };
        }
        throw error;
    }
}

export default async function D4HI3Module_EquipmentItem_Page(props: Props) {
    const { slug, team_id, item_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h-i3"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const { teamId, itemId } = parseIds(team_id, item_id);

    prefetch(
        trpc.d4hApi.getEquipmentItem.queryOptions({
            organizationId: organization.id,
            teamId,
            itemId,
        }),
    );
    prefetch(trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.d4hApi.listEquipmentCategories.queryOptions({ organizationId: organization.id }));
    prefetch(
        trpc.d4hTasks.listReturnedItemIds.queryOptions({ organizationId: organization.id, teamId }),
    );

    return (
        <HydrateClient>
            <D4HI3Module_EquipmentItem_Content teamId={teamId} itemId={itemId} />
        </HydrateClient>
    );
}
