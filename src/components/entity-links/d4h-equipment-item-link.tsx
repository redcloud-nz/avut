/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { D4HItemRef } from "@/components/d4h/d4h-item-ref";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HEquipmentItemRef } from "@/lib/schemas/d4h/equipment-item";
import { D4HMemberRef } from "@/lib/schemas/d4h/member";

import { EntityLink } from "./entity-link";

export type D4HEquipmentItemLinkProps = {
    item: D4HEquipmentItemRef;
    /** Link text in place of the ref, for call sites that hold a ready-made label and no ref. */
    label?: string;
    /**
     * The member the link is shown under, for the member-scoped page (the member in its
     * breadcrumbs). Ignored when the item belongs to another team than the member's: that page
     * would look the item up under the member's team.
     */
    member?: Pick<D4HMemberRef, "id" | "owner">;
};

export function D4HEquipmentItemLink({ item, label, member }: D4HEquipmentItemLinkProps) {
    const organization = useOrganization();

    const href =
        member && member.owner.id === item.owner.id
            ? route("/orgs/[slug]/d4h/teams/[d4h_team_id]/members/[member_id]/items/[item_id]", {
                  slug: organization.slug,
                  d4h_team_id: String(item.owner.id),
                  member_id: String(member.id),
                  item_id: String(item.id),
              })
            : route("/orgs/[slug]/d4h/teams/[d4h_team_id]/items/[item_id]", {
                  slug: organization.slug,
                  d4h_team_id: String(item.owner.id),
                  item_id: String(item.id),
              });

    return (
        <EntityLink
            href={href}
            title={label ?? <D4HItemRef value={item.ref} />}
            type="D4H Equipment Item"
        />
    );
}
