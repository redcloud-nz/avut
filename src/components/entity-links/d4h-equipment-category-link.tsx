/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HEquipmentCategoryRef } from "@/lib/schemas/d4h/equipment-category";

import { EntityLink } from "./entity-link";

export type D4HEquipmentCategoryLinkProps = {
    category: D4HEquipmentCategoryRef;
    /** The D4H team or organisation that owns the category, shown in the hover card when known. */
    owner?: { title: string };
};

export function D4HEquipmentCategoryLink({ category, owner }: D4HEquipmentCategoryLinkProps) {
    const organization = useOrganization();

    return (
        <EntityLink
            href={route("/orgs/[slug]/d4h/categories/[category_id]", {
                slug: organization.slug,
                category_id: String(category.id),
            })}
            title={category.title}
            type="Equipment Category"
        >
            {owner && <span className="text-muted-foreground">Owned by {owner.title}</span>}
        </EntityLink>
    );
}
