/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import type { RouterInput } from "@/trpc/routers/_app";

/**
 * Cache invalidations for `skillPackageBuilder` router mutations, keyed by procedure name.
 *
 * Passed as `meta.invalidates` on the corresponding `useMutation` call — see
 * `MutationInvalidator`. Covers list-level queries only; the single-entity detail queries
 * (`getPackage`, `getGroup`, `getSkill`) are synced directly via `setQueryData` at each call
 * site instead — see `docs/patterns/detail-page-data-fetching.md`.
 */
export const skillPackageBuilderInvalidations = {
    archiveGroup: (vars: RouterInput["skillPackageBuilder"]["archiveGroup"]) => [
        trpc.skillPackageBuilder.listGroups.queryFilter({ organizationId: vars.organizationId }),
    ],
    archivePackage: (vars: RouterInput["skillPackageBuilder"]["archivePackage"]) => [
        trpc.skillPackageBuilder.listPackages.queryFilter({ organizationId: vars.organizationId }),
    ],
    archiveSkill: (vars: RouterInput["skillPackageBuilder"]["archiveSkill"]) => [
        trpc.skillPackageBuilder.listSkills.queryFilter({ organizationId: vars.organizationId }),
    ],
    createGroup: (vars: RouterInput["skillPackageBuilder"]["createGroup"]) => [
        trpc.skillPackageBuilder.listGroups.queryFilter({
            organizationId: vars.organizationId,
            skillPackageId: vars.skillPackageId,
        }),
    ],
    createPackage: (vars: RouterInput["skillPackageBuilder"]["createPackage"]) => [
        trpc.skillPackageBuilder.listPackages.queryFilter({ organizationId: vars.organizationId }),
    ],
    createSkill: (vars: RouterInput["skillPackageBuilder"]["createSkill"]) => [
        trpc.skillPackageBuilder.listSkills.queryFilter({
            organizationId: vars.organizationId,
            skillPackageId: vars.skillPackageId,
        }),
    ],
    deleteGroup: (vars: RouterInput["skillPackageBuilder"]["deleteGroup"]) => [
        trpc.skillPackageBuilder.listGroups.queryFilter({ organizationId: vars.organizationId }),
    ],
    deletePackage: (vars: RouterInput["skillPackageBuilder"]["deletePackage"]) => [
        trpc.skillPackageBuilder.listPackages.queryFilter({ organizationId: vars.organizationId }),
    ],
    deleteSkill: (vars: RouterInput["skillPackageBuilder"]["deleteSkill"]) => [
        trpc.skillPackageBuilder.listSkills.queryFilter({ organizationId: vars.organizationId }),
    ],
    moveSkill: (vars: RouterInput["skillPackageBuilder"]["moveSkill"]) => [
        trpc.skillPackageBuilder.listSkills.queryFilter({
            organizationId: vars.organizationId,
            skillPackageId: vars.destinationPackageId,
        }),
    ],
    publishPackage: (vars: RouterInput["skillPackageBuilder"]["publishPackage"]) => [
        trpc.skillPackageBuilder.listPackages.queryFilter({ organizationId: vars.organizationId }),
    ],
    restoreGroup: (vars: RouterInput["skillPackageBuilder"]["restoreGroup"]) => [
        trpc.skillPackageBuilder.listGroups.queryFilter({ organizationId: vars.organizationId }),
    ],
    restorePackage: (vars: RouterInput["skillPackageBuilder"]["restorePackage"]) => [
        trpc.skillPackageBuilder.listPackages.queryFilter({ organizationId: vars.organizationId }),
    ],
    restoreSkill: (vars: RouterInput["skillPackageBuilder"]["restoreSkill"]) => [
        trpc.skillPackageBuilder.listSkills.queryFilter({ organizationId: vars.organizationId }),
    ],
    unpublishPackage: (vars: RouterInput["skillPackageBuilder"]["unpublishPackage"]) => [
        trpc.skillPackageBuilder.listPackages.queryFilter({ organizationId: vars.organizationId }),
    ],
    updateGroup: (vars: RouterInput["skillPackageBuilder"]["updateGroup"]) => [
        trpc.skillPackageBuilder.listGroups.queryFilter({ organizationId: vars.organizationId }),
    ],
    updatePackage: (vars: RouterInput["skillPackageBuilder"]["updatePackage"]) => [
        trpc.skillPackageBuilder.listPackages.queryFilter({ organizationId: vars.organizationId }),
    ],
    updateSkill: (vars: RouterInput["skillPackageBuilder"]["updateSkill"]) => [
        trpc.skillPackageBuilder.listSkills.queryFilter({ organizationId: vars.organizationId }),
    ],
} as const;
