/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import type { RouterInput, RouterOutput } from "@/trpc/routers/_app";

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

type Group = RouterOutput["skillPackageBuilder"]["getGroup"];
type SkillDetail = RouterOutput["skillPackageBuilder"]["getSkill"];

/**
 * Direct cache writes for `skillPackageBuilder` router mutations, keyed by procedure name.
 *
 * Passed as `meta.writes` on the corresponding `useMutation` call — see `MutationInvalidator`.
 * `getPackage` is flat, so package mutations write their response wholesale. `getGroup`/`getSkill`
 * are joined with their parent package/group, which group and skill mutations don't return — those
 * use an updater that merges the response into whatever's already cached, leaving the join alone.
 */
export const skillPackageBuilderWrites = {
    archiveGroup: (
        vars: RouterInput["skillPackageBuilder"]["archiveGroup"],
        { updated }: RouterOutput["skillPackageBuilder"]["archiveGroup"],
    ) => [
        {
            queryKey: trpc.skillPackageBuilder.getGroup.queryKey({
                organizationId: vars.organizationId,
                skillGroupId: vars.skillGroupId,
            }),
            data: (old: Group | undefined) => (old ? { ...old, ...updated } : old),
        },
    ],
    archivePackage: (
        vars: RouterInput["skillPackageBuilder"]["archivePackage"],
        { updated }: RouterOutput["skillPackageBuilder"]["archivePackage"],
    ) => [
        {
            queryKey: trpc.skillPackageBuilder.getPackage.queryKey({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
            data: updated,
        },
    ],
    archiveSkill: (
        vars: RouterInput["skillPackageBuilder"]["archiveSkill"],
        { updated }: RouterOutput["skillPackageBuilder"]["archiveSkill"],
    ) => [
        {
            queryKey: trpc.skillPackageBuilder.getSkill.queryKey({
                organizationId: vars.organizationId,
                skillId: vars.skillId,
            }),
            data: (old: SkillDetail | undefined) => (old ? { ...old, ...updated } : old),
        },
    ],
    publishPackage: (
        vars: RouterInput["skillPackageBuilder"]["publishPackage"],
        { published }: RouterOutput["skillPackageBuilder"]["publishPackage"],
    ) => [
        {
            queryKey: trpc.skillPackageBuilder.getPackage.queryKey({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
            data: published,
        },
    ],
    restoreGroup: (
        vars: RouterInput["skillPackageBuilder"]["restoreGroup"],
        { updated }: RouterOutput["skillPackageBuilder"]["restoreGroup"],
    ) => [
        {
            queryKey: trpc.skillPackageBuilder.getGroup.queryKey({
                organizationId: vars.organizationId,
                skillGroupId: vars.skillGroupId,
            }),
            data: (old: Group | undefined) => (old ? { ...old, ...updated } : old),
        },
    ],
    restorePackage: (
        vars: RouterInput["skillPackageBuilder"]["restorePackage"],
        { updated }: RouterOutput["skillPackageBuilder"]["restorePackage"],
    ) => [
        {
            queryKey: trpc.skillPackageBuilder.getPackage.queryKey({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
            data: updated,
        },
    ],
    restoreSkill: (
        vars: RouterInput["skillPackageBuilder"]["restoreSkill"],
        { updated }: RouterOutput["skillPackageBuilder"]["restoreSkill"],
    ) => [
        {
            queryKey: trpc.skillPackageBuilder.getSkill.queryKey({
                organizationId: vars.organizationId,
                skillId: vars.skillId,
            }),
            data: (old: SkillDetail | undefined) => (old ? { ...old, ...updated } : old),
        },
    ],
    unpublishPackage: (
        vars: RouterInput["skillPackageBuilder"]["unpublishPackage"],
        { unpublished }: RouterOutput["skillPackageBuilder"]["unpublishPackage"],
    ) => [
        {
            queryKey: trpc.skillPackageBuilder.getPackage.queryKey({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
            data: unpublished,
        },
    ],
    updateGroup: (
        vars: RouterInput["skillPackageBuilder"]["updateGroup"],
        { updated }: RouterOutput["skillPackageBuilder"]["updateGroup"],
    ) => [
        {
            queryKey: trpc.skillPackageBuilder.getGroup.queryKey({
                organizationId: vars.organizationId,
                skillGroupId: vars.skillGroupId,
            }),
            data: (old: Group | undefined) => (old ? { ...old, ...updated } : old),
        },
    ],
    updatePackage: (
        vars: RouterInput["skillPackageBuilder"]["updatePackage"],
        { updated }: RouterOutput["skillPackageBuilder"]["updatePackage"],
    ) => [
        {
            queryKey: trpc.skillPackageBuilder.getPackage.queryKey({
                organizationId: vars.organizationId,
                skillPackageId: vars.skillPackageId,
            }),
            data: updated,
        },
    ],
    updateSkill: (
        vars: RouterInput["skillPackageBuilder"]["updateSkill"],
        { updated }: RouterOutput["skillPackageBuilder"]["updateSkill"],
    ) => [
        {
            queryKey: trpc.skillPackageBuilder.getSkill.queryKey({
                organizationId: vars.organizationId,
                skillId: vars.skillId,
            }),
            data: (old: SkillDetail | undefined) => (old ? { ...old, ...updated } : old),
        },
    ],
} as const;
