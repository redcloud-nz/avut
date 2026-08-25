/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Std } from "@/components/blocks/std";
import { NotImplemented } from "@/components/nav/errors";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

export function SkillPackageBuilder_PackageHistory_Content({
    skillPackageId,
}: {
    skillPackageId: SkillPackageId;
}) {
    const organization = useOrganization();

    const { data: skillPackage } = useSuspenseQuery(
        trpc.skillPackageBuilder.getPackage.queryOptions({
            organizationId: organization.id,
            skillPackageId,
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
                        label: skillPackage.name,
                        href: route("/orgs/[slug]/skill-package-builder/packages/[package_id]", {
                            slug: organization.slug,
                            package_id: skillPackageId,
                        }),
                    },
                    "History",
                ]}
            />
            <Std.ScrollContainer>
                <NotImplemented />
            </Std.ScrollContainer>
        </>
    );
}
