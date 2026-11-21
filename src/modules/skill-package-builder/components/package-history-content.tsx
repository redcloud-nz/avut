/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { ObjectHistory } from "@/components/history/object-history";
import { useOrganization } from "@/hooks/use-organization";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

import { packageBreadcrumbs } from "../lib/breadcrumbs";

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
        <ObjectHistory
            objectType="SkillPackage"
            objectId={skillPackageId}
            title="Package History"
            breadcrumbs={[
                ...packageBreadcrumbs(organization.slug, {
                    id: skillPackageId,
                    name: skillPackage.name,
                }),
            ]}
        />
    );
}
