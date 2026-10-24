/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HEquipmentBrandRef } from "@/lib/schemas/d4h/equipment-brand";

import { EntityLink } from "./entity-link";

export type D4HEquipmentBrandLinkProps = {
    brand: D4HEquipmentBrandRef;
};

export function D4HEquipmentBrandLink({ brand }: D4HEquipmentBrandLinkProps) {
    const organization = useOrganization();

    return (
        <EntityLink
            href={route("/orgs/[slug]/d4h/brands/[brand_id]", {
                slug: organization.slug,
                brand_id: String(brand.id),
            })}
            title={brand.title}
            type="Equipment Brand"
        />
    );
}
