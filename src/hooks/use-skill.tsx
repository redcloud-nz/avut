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
import { Skill } from "@/lib/schemas/skill";

/**
 * Hook to fetch (using TRPC) a specific skill along with its parent skill group and skill package.
 * @param skillPackageId - The ID of the skill package the skill belongs to.
 * @param skillGroupId - The ID of the skill group the skill belongs to.
 * @param skillId - The ID of the skill to fetch.
 * @returns An object containing the skill, its parent skill group, and its parent skill package.
 * @throws Will throw an error if the skill package, skill group, or skill is not found, or if the relationships are invalid.
 */
export function useSkill({
    skillPackageId,
    skillId,
}: {
    skillPackageId: string;
    skillId: string;
}): Skill & { skillGroup: SkillGroup; skillPackage: SkillPackage } {
    const organization = useOrganization();

    const [{ data: skillPackages }, { data: skillGroups }, { data: skills }] =
        useSuspenseQueries({
            queries: [
                trpc.skills.listPackages.queryOptions({
                    organizationId: organization.id,
                }),
                trpc.skills.listGroups.queryOptions({
                    organizationId: organization.id,
                    skillPackageId: skillPackageId,
                }),
                trpc.skills.listSkills.queryOptions({
                    organizationId: organization.id,
                    skillPackageId: skillPackageId,
                }),
            ],
        });

    const skillPackage = skillPackages.find((pkg) => pkg.id === skillPackageId);
    if (!skillPackage)
        throw new Error(`SkillPackage(${skillPackageId}) not found`);

    const skill = skills.find((skl) => skl.id === skillId);
    if (!skill) throw new Error(`Skill(${skillId}) not found`);

    const skillGroup = skillGroups.find((grp) => grp.id === skill.skillGroupId);
    if (!skillGroup)
        throw new Error(`SkillGroup(${skill.skillGroupId}) not found`);

    if (skill.skillPackageId !== skillPackageId)
        throw new Error(
            `Skill(${skillId}) does not belong to SkillPackage(${skillPackageId})`,
        );

    return { ...skill, skillGroup, skillPackage };
}
