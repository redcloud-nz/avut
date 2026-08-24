/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import type { RouterInput, RouterOutput } from "@/trpc/routers/_app";

/**
 * Cache invalidations for `skills` router mutations, keyed by procedure name.
 *
 * Passed as `meta.invalidates` on the corresponding `useMutation` call — see
 * `MutationInvalidator`. Covers list-level queries only; detail/scoped queries
 * (`getSession`, `listSessionAssessees`/`listSessionSkills` with `scope: "assigned"`) are synced
 * directly via `setQueryData` at each call site instead — see
 * `docs/patterns/detail-page-data-fetching.md`.
 */
export const skillsInvalidations = {
    createSession: (vars: RouterInput["skills"]["createSession"]) => [
        trpc.skills.listSessions.queryFilter({ organizationId: vars.organizationId }),
    ],
    deleteSession: (vars: RouterInput["skills"]["deleteSession"]) => [
        trpc.skills.listSessions.queryFilter({ organizationId: vars.organizationId }),
    ],
    subscribeToPackage: (vars: RouterInput["skills"]["subscribeToPackage"]) => [
        trpc.skills.listPackages.queryFilter({ organizationId: vars.organizationId }),
    ],
    unsubscribeFromPackage: (vars: RouterInput["skills"]["unsubscribeFromPackage"]) => [
        trpc.skills.listPackages.queryFilter({ organizationId: vars.organizationId }),
    ],
    updateSession: (vars: RouterInput["skills"]["updateSession"]) => [
        trpc.skills.listSessions.queryFilter({ organizationId: vars.organizationId }),
    ],
    updateSessionAssessees: (vars: RouterInput["skills"]["updateSessionAssessees"]) => [
        trpc.skills.listSessionAssessees.queryFilter({
            organizationId: vars.organizationId,
            sessionId: vars.skillCheckSessionId,
            scope: "all",
        }),
    ],
    updateSessionSkills: (vars: RouterInput["skills"]["updateSessionSkills"]) => [
        trpc.skills.listSessionSkills.queryFilter({
            organizationId: vars.organizationId,
            sessionId: vars.skillCheckSessionId,
            scope: "all",
        }),
    ],
} as const;

type Session = RouterOutput["skills"]["getSession"];

/**
 * Direct cache writes for `skills` router mutations, keyed by procedure name.
 *
 * Passed as `meta.writes` on the corresponding `useMutation` call — see `MutationInvalidator`.
 * `createSession`'s response matches `getSession` exactly, so it writes wholesale. The others
 * return a bare `SkillCheckSession` without the `assessors` extension `getSession` carries, so
 * they merge into whatever's already cached instead of replacing it.
 */
export const skillsWrites = {
    createSession: (
        vars: RouterInput["skills"]["createSession"],
        { created }: RouterOutput["skills"]["createSession"],
    ) => [
        {
            queryKey: trpc.skills.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            data: created,
        },
    ],
    updateSession: (
        vars: RouterInput["skills"]["updateSession"],
        { updated }: RouterOutput["skills"]["updateSession"],
    ) => [
        {
            queryKey: trpc.skills.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            data: (old: Session | undefined) => (old ? { ...old, ...updated } : old),
        },
    ],
    updateSessionAssessees: (
        vars: RouterInput["skills"]["updateSessionAssessees"],
        { updatedAssessees, updatedSession }: RouterOutput["skills"]["updateSessionAssessees"],
    ) => [
        {
            queryKey: trpc.skills.listSessionAssessees.queryKey({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
                scope: "assigned",
            }),
            data: updatedAssessees,
        },
        {
            queryKey: trpc.skills.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            data: (old: Session | undefined) => (old ? { ...old, ...updatedSession } : old),
        },
    ],
    updateSessionSkills: (
        vars: RouterInput["skills"]["updateSessionSkills"],
        { updatedSkills, updatedSession }: RouterOutput["skills"]["updateSessionSkills"],
    ) => [
        {
            queryKey: trpc.skills.listSessionSkills.queryKey({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
                scope: "assigned",
            }),
            data: updatedSkills,
        },
        {
            queryKey: trpc.skills.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            data: (old: Session | undefined) => (old ? { ...old, ...updatedSession } : old),
        },
    ],
} as const;
