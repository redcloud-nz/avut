/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { SkillPackage } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";
import { useOrganization } from "./use-organization";

/**
 * Fetches a skill package by its ID using TRPC and React Query.
 * @param packageId The ID of the skill package to fetch.
 * @returns The skill package with the specified ID.
 */
export function useSkillPackage(packageId: string): SkillPackage {
    const organization = useOrganization();

    const { data: skillPackages } = useSuspenseQuery(
        trpc.skills.listPackages.queryOptions({
            organizationId: organization.id,
        }),
    );

    const skillPackage = skillPackages.find((pkg) => pkg.id === packageId);
    if (!skillPackage) throw new Error(`SkillPackage(${packageId}) not found`);

    return skillPackage;
}
