/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { invalidate, write } from "@/trpc/mutation-invalidator";
import { trpc } from "@/trpc/client";
import type { RouterInput, RouterOutput } from "@/trpc/routers/_app";

type Session = RouterOutput["skills"]["getSession"];

/**
 * Cache effects for `skills` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `MutationInvalidator`.
 * `createSession`'s response matches `getSession` exactly, so it writes wholesale. `updateSession`
 * and the session halves of `updateSessionAssessees`/`updateSessionSkills` return a bare
 * `SkillCheckSession` without the `assessors` extension `getSession` carries, so they merge into
 * whatever's already cached instead of replacing it.
 */
export const skillsEffects = {
    createSession: (
        vars: RouterInput["skills"]["createSession"],
        { created }: RouterOutput["skills"]["createSession"],
    ) => [
        write(
            trpc.skills.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            created,
        ),
        invalidate(trpc.skills.listSessions.queryFilter({ organizationId: vars.organizationId })),
    ],
    deleteSession: (vars: RouterInput["skills"]["deleteSession"]) => [
        invalidate(trpc.skills.listSessions.queryFilter({ organizationId: vars.organizationId })),
    ],
    subscribeToPackage: (vars: RouterInput["skills"]["subscribeToPackage"]) => [
        invalidate(trpc.skills.listPackages.queryFilter({ organizationId: vars.organizationId })),
    ],
    unsubscribeFromPackage: (vars: RouterInput["skills"]["unsubscribeFromPackage"]) => [
        invalidate(trpc.skills.listPackages.queryFilter({ organizationId: vars.organizationId })),
    ],
    updateSession: (
        vars: RouterInput["skills"]["updateSession"],
        { updated }: RouterOutput["skills"]["updateSession"],
    ) => [
        write(
            trpc.skills.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            (old: Session | undefined) => (old ? { ...old, ...updated } : old),
        ),
        invalidate(trpc.skills.listSessions.queryFilter({ organizationId: vars.organizationId })),
    ],
    updateSessionAssessees: (
        vars: RouterInput["skills"]["updateSessionAssessees"],
        { updatedAssessees, updatedSession }: RouterOutput["skills"]["updateSessionAssessees"],
    ) => [
        write(
            trpc.skills.listSessionAssessees.queryKey({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
                scope: "assigned",
            }),
            updatedAssessees,
        ),
        write(
            trpc.skills.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            (old: Session | undefined) => (old ? { ...old, ...updatedSession } : old),
        ),
        invalidate(
            trpc.skills.listSessionAssessees.queryFilter({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
                scope: "all",
            }),
        ),
    ],
    updateSessionSkills: (
        vars: RouterInput["skills"]["updateSessionSkills"],
        { updatedSkills, updatedSession }: RouterOutput["skills"]["updateSessionSkills"],
    ) => [
        write(
            trpc.skills.listSessionSkills.queryKey({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
                scope: "assigned",
            }),
            updatedSkills,
        ),
        write(
            trpc.skills.getSession.queryKey({
                organizationId: vars.organizationId,
                skillCheckSessionId: vars.skillCheckSessionId,
            }),
            (old: Session | undefined) => (old ? { ...old, ...updatedSession } : old),
        ),
        invalidate(
            trpc.skills.listSessionSkills.queryFilter({
                organizationId: vars.organizationId,
                sessionId: vars.skillCheckSessionId,
                scope: "all",
            }),
        ),
    ],
} as const;
