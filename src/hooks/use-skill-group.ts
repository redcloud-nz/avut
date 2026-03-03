/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQueries } from "@tanstack/react-query";

import { SkillGroup } from "@/lib/schemas/skill-group";
import { SkillPackage } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

import { useOrganization } from "./use-organization";

/**
 * Hook to fetch (using TRPC) a specific skill group along with its parent skill package.
 * @param skillPackageId - The ID of the skill package the skill group belongs to.
 * @param skillGroupId - The ID of the skill group to fetch.
 * @returns An object containing the skill group and its parent skill package.
 * @throws Will throw an error if the skill package or skill group is not found, or if the relationships are invalid.
 */
export function useSkillGroup({
    skillPackageId,
    skillGroupId,
}: {
    skillPackageId: string;
    skillGroupId: string;
}): SkillGroup & { skillPackage: SkillPackage } {
    const organization = useOrganization();

    const [{ data: skillPackages }, { data: skillGroups }] = useSuspenseQueries(
        {
            queries: [
                trpc.skillPackageBuilder.listPackages.queryOptions({
                    organizationId: organization.id,
                }),
                trpc.skillPackageBuilder.listGroups.queryOptions({
                    organizationId: organization.id,
                    skillPackageId: skillPackageId,
                }),
            ],
        },
    );

    const skillPackage = skillPackages.find((pkg) => pkg.id === skillPackageId);
    const skillGroup = skillGroups.find((grp) => grp.id === skillGroupId);

    if (!skillPackage)
        throw new Error(`SkillPackage(${skillPackageId}) not found`);
    if (!skillGroup) throw new Error(`SkillGroup(${skillGroupId}) not found`);

    if (skillGroup.skillPackageId !== skillPackageId)
        throw new Error(
            `SkillGroup(${skillGroupId}) does not belong to SkillPackage(${skillPackageId})`,
        );

    return { ...skillGroup, skillPackage };
}
