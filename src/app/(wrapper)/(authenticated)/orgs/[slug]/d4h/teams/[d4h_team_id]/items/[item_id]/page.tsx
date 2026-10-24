/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h/teams/[d4h_team_id]/items/[item_id]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { TRPCError } from "@trpc/server";

import { TITLE_SEPARATOR } from "@/lib/constants";
import {
    D4HI3Module_ItemReturn_Dialog,
    D4HI3Module_ItemReturn_MenuAction,
} from "@/modules/d4h-i3/components/equipment-item/item-return-action";
import { D4HI3Module_ItemReturnedBadge } from "@/modules/d4h-i3/components/equipment-item/item-returned-badge";
import { D4HModule_EquipmentItem_Content } from "@/modules/d4h/components/items/equipment-item-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/d4h/teams/[d4h_team_id]/items/[item_id]">;

function parseIds(d4h_team_id: string, item_id: string) {
    const teamId = Number(d4h_team_id);
    const itemId = Number(item_id);
    if (!Number.isInteger(teamId) || !Number.isInteger(itemId)) notFound();
    return { teamId, itemId };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, d4h_team_id, item_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return {};
    const organization = await getOrganizationBySlug(slug);

    const { teamId, itemId } = parseIds(d4h_team_id, item_id);

    try {
        const { item } = await fetchQuery(
            trpc.d4hApi.getEquipmentItem.queryOptions({
                organizationId: organization.id,
                teamId,
                itemId,
            }),
        );
        return { title: `Item #${item.ref} ${TITLE_SEPARATOR} D4H` };
    } catch (error) {
        // No D4H token: keep a usable title, and let the page's error boundary explain.
        if (error instanceof TRPCError && error.code === "PRECONDITION_FAILED") {
            return { title: `Item #${item_id} ${TITLE_SEPARATOR} D4H` };
        }
        throw error;
    }
}

/**
 * A D4H equipment item. When D4H I3 is usable, I3's Return action and returned badge are passed
 * in as slots: the D4H module can't import I3, but the page can.
 */
export default async function D4HModule_EquipmentItem_Page(props: Props) {
    const { slug, d4h_team_id, item_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "d4h"))) return null;
    const organization = await getOrganizationBySlug(slug);
    const withI3 = await isOrganizationModuleUsable(slug, "d4h-i3");

    const { teamId, itemId } = parseIds(d4h_team_id, item_id);

    prefetch(
        trpc.d4hApi.getEquipmentItem.queryOptions({
            organizationId: organization.id,
            teamId,
            itemId,
        }),
    );
    prefetch(
        trpc.d4hApi.listEquipmentItemContents.queryOptions({
            organizationId: organization.id,
            teamId,
            itemId,
        }),
    );
    prefetch(trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }));
    prefetch(trpc.d4hApi.listEquipmentCategories.queryOptions({ organizationId: organization.id }));
    // The tasks card renders only for `d4hTask: ["view"]`; for anyone else this prefetch fails
    // quietly and the card never asks for it.
    prefetch(
        trpc.d4hTasks.listItemTasks.queryOptions({
            organizationId: organization.id,
            teamId,
            itemId,
        }),
    );
    if (withI3) {
        prefetch(
            trpc.d4hTasks.listReturnedItemIds.queryOptions({
                organizationId: organization.id,
                teamId,
            }),
        );
    }

    return (
        <HydrateClient>
            <D4HModule_EquipmentItem_Content
                teamId={teamId}
                itemId={itemId}
                menuActions={
                    withI3 ? (
                        <D4HI3Module_ItemReturn_MenuAction teamId={teamId} itemId={itemId} />
                    ) : null
                }
                menuDialogs={
                    withI3 ? (
                        <D4HI3Module_ItemReturn_Dialog teamId={teamId} itemId={itemId} />
                    ) : null
                }
                statusBadge={
                    withI3 ? (
                        <D4HI3Module_ItemReturnedBadge teamId={teamId} itemId={itemId} />
                    ) : null
                }
            />
        </HydrateClient>
    );
}
