/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillRef } from "@/lib/schemas/skill";

import { EntityLink } from "./entity-link";

export type SkillLinkProps = {
    skill: SkillRef;
};

export function SkillLink({ skill }: SkillLinkProps) {
    const organization = useOrganization();

    return (
        <EntityLink
            href={route("/orgs/[slug]/skill-track/skills/[skill_id]", {
                slug: organization.slug,
                skill_id: skill.id,
            })}
            title={skill.name}
            type="Skill"
        />
    );
}
