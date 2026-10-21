/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillGroupRef } from "@/lib/schemas/skill-group";

import { EntityLink } from "./entity-link";

export type SkillGroupLinkProps = {
    group: SkillGroupRef;
};

export function SkillGroupLink({ group }: SkillGroupLinkProps) {
    const organization = useOrganization();

    return (
        <EntityLink
            href={route("/orgs/[slug]/skill-track/packages/[package_id]/groups/[group_id]", {
                slug: organization.slug,
                package_id: group.skillPackageId,
                group_id: group.id,
            })}
            title={group.name}
            type="Skill Group"
        />
    );
}
