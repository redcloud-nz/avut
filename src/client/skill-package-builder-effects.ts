/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { createEffects, invalidate, write } from "@/trpc/mutation-effector";
import { trpc } from "@/trpc/client";

/**
 * Cache effects for `skillPackageBuilder` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `MutationInvalidator`.
 * `getPackage` is flat, so package mutations write their response wholesale. `getGroup`/`getSkill`
 * are joined with their parent package/group, which group and skill mutations don't return — those
 * use an updater that merges the response into whatever's already cached, leaving the join alone.
 */
export const skillPackageBuilderEffects = createEffects<"skillPackageBuilder">()({
    archiveGroup: (vars, { updated }) => [
        write(
            trpc.skillPackageBuilder.getGroup.queryKey({
                organizationId: vars.organizationId,
                skillGroupId: vars.skillGroupId,
            }),
            (old) => (old ? { ...old, ...updated } : old),
        ),
        invalidate(
            trpc.skillPackageBuilder.listGroups.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    archivePackage: (vars, { updated }) => [
        write(
            trpc.skillPackageBuilder.getPackage.queryKey({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
            updated,
        ),
        invalidate(
            trpc.skillPackageBuilder.listPackages.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    archiveSkill: (vars, { updated }) => [
        write(
            trpc.skillPackageBuilder.getSkill.queryKey({
                organizationId: vars.organizationId,
                skillId: vars.skillId,
            }),
            (old) => (old ? { ...old, ...updated } : old),
        ),
        invalidate(
            trpc.skillPackageBuilder.listSkills.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    createGroup: (vars) => [
        invalidate(
            trpc.skillPackageBuilder.listGroups.queryFilter({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
        ),
    ],
    createPackage: (vars) => [
        invalidate(
            trpc.skillPackageBuilder.listPackages.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    createSkill: (vars) => [
        invalidate(
            trpc.skillPackageBuilder.listSkills.queryFilter({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
        ),
    ],
    deleteGroup: (vars) => [
        invalidate(
            trpc.skillPackageBuilder.listGroups.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    deletePackage: (vars) => [
        invalidate(
            trpc.skillPackageBuilder.listPackages.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    deleteSkill: (vars) => [
        invalidate(
            trpc.skillPackageBuilder.listSkills.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    moveSkill: (vars) => [
        invalidate(
            trpc.skillPackageBuilder.listSkills.queryFilter({
                organizationId: vars.organizationId,
                skillPackageId: vars.destinationPackageId,
            }),
        ),
    ],
    publishPackage: (vars, { published }) => [
        write(
            trpc.skillPackageBuilder.getPackage.queryKey({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
            published,
        ),
        invalidate(
            trpc.skillPackageBuilder.listPackages.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    restoreGroup: (vars, { updated }) => [
        write(
            trpc.skillPackageBuilder.getGroup.queryKey({
                organizationId: vars.organizationId,
                skillGroupId: vars.skillGroupId,
            }),
            (old) => (old ? { ...old, ...updated } : old),
        ),
        invalidate(
            trpc.skillPackageBuilder.listGroups.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    restorePackage: (vars, { updated }) => [
        write(
            trpc.skillPackageBuilder.getPackage.queryKey({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
            updated,
        ),
        invalidate(
            trpc.skillPackageBuilder.listPackages.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    restoreSkill: (vars, { updated }) => [
        write(
            trpc.skillPackageBuilder.getSkill.queryKey({
                organizationId: vars.organizationId,
                skillId: vars.skillId,
            }),
            (old) => (old ? { ...old, ...updated } : old),
        ),
        invalidate(
            trpc.skillPackageBuilder.listSkills.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    unpublishPackage: (vars, { unpublished }) => [
        write(
            trpc.skillPackageBuilder.getPackage.queryKey({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
            unpublished,
        ),
        invalidate(
            trpc.skillPackageBuilder.listPackages.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    updateGroup: (vars, { updated }) => [
        write(
            trpc.skillPackageBuilder.getGroup.queryKey({
                organizationId: vars.organizationId,
                skillGroupId: vars.skillGroupId,
            }),
            (old) => (old ? { ...old, ...updated } : old),
        ),
        invalidate(
            trpc.skillPackageBuilder.listGroups.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    updatePackage: (vars, { updated }) => [
        write(
            trpc.skillPackageBuilder.getPackage.queryKey({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
            updated,
        ),
        invalidate(
            trpc.skillPackageBuilder.listPackages.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    updateSkill: (vars, { updated }) => [
        write(
            trpc.skillPackageBuilder.getSkill.queryKey({
                organizationId: vars.organizationId,
                skillId: vars.skillId,
            }),
            (old) => (old ? { ...old, ...updated } : old),
        ),
        invalidate(
            trpc.skillPackageBuilder.listSkills.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
});
