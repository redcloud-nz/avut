/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h/teams/[d4h_team_id]/members/[member_id]/items/[item_id]
 */

import { Metadata } from "next";

import {
    D4HEquipmentItemPage,
    equipmentItemMetadata,
} from "@/app/(wrapper)/(authenticated)/orgs/[slug]/d4h/teams/[d4h_team_id]/_components/equipment-item-page";

type Props = PageProps<"/orgs/[slug]/d4h/teams/[d4h_team_id]/members/[member_id]/items/[item_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    return equipmentItemMetadata(await props.params);
}

/**
 * A D4H equipment item reached from a member's page. The same page as the team-level route, with
 * the member in the breadcrumbs. It still renders if the item has since moved to another holder.
 */
export default async function D4HModule_MemberEquipmentItem_Page(props: Props) {
    return <D4HEquipmentItemPage {...await props.params} />;
}
