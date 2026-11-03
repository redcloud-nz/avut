/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HEquipmentKindRef } from "@/lib/schemas/d4h/equipment-kind";

import { EntityLink } from "./entity-link";

export type D4HIssuedTypeLinkProps = {
    /** The D4H team whose members' issued items of this type the page lists. */
    teamId: number;
    type: D4HEquipmentKindRef;
};

/** Links an equipment type to D4H I3's page of the items of that type issued to one team. */
export function D4HIssuedTypeLink({ teamId, type }: D4HIssuedTypeLinkProps) {
    const organization = useOrganization();

    return (
        <EntityLink
            href={route("/orgs/[slug]/d4h-i3/teams/[d4h_team_id]/issued-types/[type_id]", {
                slug: organization.slug,
                d4h_team_id: String(teamId),
                type_id: String(type.id),
            })}
            title={type.title}
            type="D4H Issued Type"
        />
    );
}
