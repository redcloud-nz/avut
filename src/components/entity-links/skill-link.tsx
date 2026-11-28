/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useScopedRoute } from "@/hooks/use-scoped-route";
import { SkillRef } from "@/lib/schemas/skill";

import { EntityLink } from "./entity-link";

export type SkillLinkProps = {
    skill: SkillRef;
};

export function SkillLink({ skill }: SkillLinkProps) {
    const scopedRoute = useScopedRoute();

    return (
        <EntityLink
            href={scopedRoute(
                {
                    organization: "/orgs/[slug]/skill-track/skills/[skill_id]",
                    team: "/teams/[slug]/skill-track/skills/[skill_id]",
                },
                { skill_id: skill.id },
            )}
            title={skill.name}
            type="Skill"
        />
    );
}
