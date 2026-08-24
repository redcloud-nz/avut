/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { invalidate, write } from "@/trpc/mutation-invalidator";
import { trpc } from "@/trpc/client";
import type { RouterInput, RouterOutput } from "@/trpc/routers/_app";

/**
 * Cache effects for `skillPackageBuilder` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `MutationInvalidator`.
 * `getPackage` is flat, so package mutations write their response wholesale. `getGroup`/`getSkill`
 * are joined with their parent package/group, which group and skill mutations don't return — those
 * use an updater that merges the response into whatever's already cached, leaving the join alone.
 */
export const skillPackageBuilderEffects = {
    archiveGroup: (
        vars: RouterInput["skillPackageBuilder"]["archiveGroup"],
        { updated }: RouterOutput["skillPackageBuilder"]["archiveGroup"],
    ) => [
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
    archivePackage: (
        vars: RouterInput["skillPackageBuilder"]["archivePackage"],
        { updated }: RouterOutput["skillPackageBuilder"]["archivePackage"],
    ) => [
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
    archiveSkill: (
        vars: RouterInput["skillPackageBuilder"]["archiveSkill"],
        { updated }: RouterOutput["skillPackageBuilder"]["archiveSkill"],
    ) => [
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
    createGroup: (vars: RouterInput["skillPackageBuilder"]["createGroup"]) => [
        invalidate(
            trpc.skillPackageBuilder.listGroups.queryFilter({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
        ),
    ],
    createPackage: (vars: RouterInput["skillPackageBuilder"]["createPackage"]) => [
        invalidate(
            trpc.skillPackageBuilder.listPackages.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    createSkill: (vars: RouterInput["skillPackageBuilder"]["createSkill"]) => [
        invalidate(
            trpc.skillPackageBuilder.listSkills.queryFilter({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
        ),
    ],
    deleteGroup: (vars: RouterInput["skillPackageBuilder"]["deleteGroup"]) => [
        invalidate(
            trpc.skillPackageBuilder.listGroups.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    deletePackage: (vars: RouterInput["skillPackageBuilder"]["deletePackage"]) => [
        invalidate(
            trpc.skillPackageBuilder.listPackages.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    deleteSkill: (vars: RouterInput["skillPackageBuilder"]["deleteSkill"]) => [
        invalidate(
            trpc.skillPackageBuilder.listSkills.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ],
    moveSkill: (vars: RouterInput["skillPackageBuilder"]["moveSkill"]) => [
        invalidate(
            trpc.skillPackageBuilder.listSkills.queryFilter({
                organizationId: vars.organizationId,
                skillPackageId: vars.destinationPackageId,
            }),
        ),
    ],
    publishPackage: (
        vars: RouterInput["skillPackageBuilder"]["publishPackage"],
        { published }: RouterOutput["skillPackageBuilder"]["publishPackage"],
    ) => [
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
    restoreGroup: (
        vars: RouterInput["skillPackageBuilder"]["restoreGroup"],
        { updated }: RouterOutput["skillPackageBuilder"]["restoreGroup"],
    ) => [
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
    restorePackage: (
        vars: RouterInput["skillPackageBuilder"]["restorePackage"],
        { updated }: RouterOutput["skillPackageBuilder"]["restorePackage"],
    ) => [
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
    restoreSkill: (
        vars: RouterInput["skillPackageBuilder"]["restoreSkill"],
        { updated }: RouterOutput["skillPackageBuilder"]["restoreSkill"],
    ) => [
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
    unpublishPackage: (
        vars: RouterInput["skillPackageBuilder"]["unpublishPackage"],
        { unpublished }: RouterOutput["skillPackageBuilder"]["unpublishPackage"],
    ) => [
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
    updateGroup: (
        vars: RouterInput["skillPackageBuilder"]["updateGroup"],
        { updated }: RouterOutput["skillPackageBuilder"]["updateGroup"],
    ) => [
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
    updatePackage: (
        vars: RouterInput["skillPackageBuilder"]["updatePackage"],
        { updated }: RouterOutput["skillPackageBuilder"]["updatePackage"],
    ) => [
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
    updateSkill: (
        vars: RouterInput["skillPackageBuilder"]["updateSkill"],
        { updated }: RouterOutput["skillPackageBuilder"]["updateSkill"],
    ) => [
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
} as const;
