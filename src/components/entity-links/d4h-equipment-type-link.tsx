/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HEquipmentKindRef } from "@/lib/schemas/d4h/equipment-kind";

import { EntityLink } from "./entity-link";

export type D4HEquipmentTypeLinkProps = {
    /** D4H calls equipment types "kinds" (`EquipmentKind`); users see "Type". */
    type: D4HEquipmentKindRef;
};

export function D4HEquipmentTypeLink({ type }: D4HEquipmentTypeLinkProps) {
    const organization = useOrganization();

    return (
        <EntityLink
            href={route("/orgs/[slug]/d4h/types/[type_id]", {
                slug: organization.slug,
                type_id: String(type.id),
            })}
            title={type.title}
            type="Equipment Type"
        />
    );
}
