/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { D4HEquipmentModel, D4HEquipmentModelRef } from "@/lib/schemas/d4h/equipment-model";

import { EntityLink } from "./entity-link";

export type D4HEquipmentModelLinkProps = {
    /** `owner`, when known, is shown in the hover card. */
    model: D4HEquipmentModelRef & Partial<Pick<D4HEquipmentModel, "owner">>;
};

export function D4HEquipmentModelLink({ model }: D4HEquipmentModelLinkProps) {
    const organization = useOrganization();
    const { owner } = model;

    return (
        <EntityLink
            href={route("/orgs/[slug]/d4h/models/[model_id]", {
                slug: organization.slug,
                model_id: String(model.id),
            })}
            title={model.title}
            type="D4H Equipment Model"
        >
            {owner && <span className="text-muted-foreground">Owned by {owner.title}</span>}
        </EntityLink>
    );
}
