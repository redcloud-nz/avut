/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/d4h/teams/[d4h_team_id]/items/[item_id]
 */

import { Metadata } from "next";

import {
    D4HEquipmentItemPage,
    equipmentItemMetadata,
} from "@/app/(wrapper)/(authenticated)/orgs/[slug]/d4h/teams/[d4h_team_id]/_components/equipment-item-page";

type Props = PageProps<"/orgs/[slug]/d4h/teams/[d4h_team_id]/items/[item_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    return equipmentItemMetadata(await props.params);
}

/** A D4H equipment item: the canonical page, which every item link goes to by default. */
export default async function D4HModule_EquipmentItem_Page(props: Props) {
    return <D4HEquipmentItemPage {...await props.params} />;
}
