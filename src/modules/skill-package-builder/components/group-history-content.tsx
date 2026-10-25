/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Std } from "@/components/blocks/std";
import { ObjectHistory } from "@/components/history/object-history";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_GroupHistory_Content({
    skillGroupId,
}: {
    skillGroupId: SkillGroupId;
}) {
    const organization = useOrganization();

    const { data: skillGroup } = useSuspenseQuery(
        trpc.skillPackageBuilder.getGroup.queryOptions({
            organizationId: organization.id,
            skillGroupId,
        }),
    );

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Skill Package Builder",
                        href: route("/orgs/[slug]/skill-package-builder", {
                            slug: organization.slug,
                        }),
                    },
                    {
                        label: skillGroup.skillPackage.name,
                        href: route("/orgs/[slug]/skill-package-builder/packages/[package_id]", {
                            slug: organization.slug,
                            package_id: skillGroup.skillPackageId,
                        }),
                    },
                    "Groups",
                    {
                        label: skillGroup.name,
                        href: route(
                            "/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]",
                            {
                                slug: organization.slug,
                                package_id: skillGroup.skillPackageId,
                                group_id: skillGroupId,
                            },
                        ),
                    },
                    "History",
                ]}
            />
            <Std.ScrollContainer>
                <ObjectHistory
                    objectType="SkillGroup"
                    objectId={skillGroupId}
                    title={`${skillGroup.name} — History`}
                />
            </Std.ScrollContainer>
        </>
    );
}
