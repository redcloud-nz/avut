/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HEquipmentItemRef } from "@/lib/schemas/d4h/equipment-item";

import { EntityLink } from "./entity-link";

export type D4HEquipmentItemLinkProps = {
    item: D4HEquipmentItemRef;
    /** Link text in place of `#<ref>`, for call sites that hold a ready-made label and no ref. */
    label?: string;
};

export function D4HEquipmentItemLink({ item, label }: D4HEquipmentItemLinkProps) {
    const organization = useOrganization();

    return (
        <EntityLink
            href={route("/orgs/[slug]/d4h/teams/[d4h_team_id]/items/[item_id]", {
                slug: organization.slug,
                d4h_team_id: String(item.owner.id),
                item_id: String(item.id),
            })}
            title={label ?? `#${item.ref}`}
            type="Equipment Item"
        />
    );
}
