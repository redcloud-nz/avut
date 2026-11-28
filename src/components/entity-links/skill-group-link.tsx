/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useScopedRoute } from "@/hooks/use-scoped-route";
import { SkillGroupRef } from "@/lib/schemas/skill-group";

import { EntityLink } from "./entity-link";

export type SkillGroupLinkProps = {
    group: SkillGroupRef;
};

export function SkillGroupLink({ group }: SkillGroupLinkProps) {
    const scopedRoute = useScopedRoute();

    return (
        <EntityLink
            href={scopedRoute(
                {
                    organization:
                        "/orgs/[slug]/skill-track/packages/[package_id]/groups/[group_id]",
                    team: "/teams/[slug]/skill-track/packages/[package_id]/groups/[group_id]",
                },
                { package_id: group.skillPackageId, group_id: group.id },
            )}
            title={group.name}
            type="Skill Group"
        />
    );
}
