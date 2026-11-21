/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { ObjectHistory } from "@/components/history/object-history";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillId } from "@/lib/schemas/skill";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_SkillHistory_Content({ skillId }: { skillId: SkillId }) {
    const organization = useOrganization();

    const { data: skill } = useSuspenseQuery(
        trpc.skillPackageBuilder.getSkill.queryOptions({
            organizationId: organization.id,
            skillId,
        }),
    );

    return (
        <ObjectHistory
            objectType="Skill"
            objectId={skillId}
            title="Skill History"
            breadcrumbs={[
                {
                    label: skill.skillPackage.name,
                    href: route("/orgs/[slug]/skill-package-builder/packages/[package_id]", {
                        slug: organization.slug,
                        package_id: skill.skillPackageId,
                    }),
                },
                {
                    label: skill.name,
                    href: route(
                        "/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]",
                        {
                            slug: organization.slug,
                            package_id: skill.skillPackageId,
                            skill_id: skillId,
                        },
                    ),
                },
            ]}
        />
    );
}
