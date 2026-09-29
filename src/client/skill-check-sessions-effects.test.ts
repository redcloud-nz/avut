/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { QueryClient } from "@tanstack/react-query";

import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheck, SkillCheckId, SkillCheckResultValue } from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { trpc } from "@/trpc/client";
import type { MutationEffect } from "@/trpc/mutation-effector";

import { skillCheckSessionsEffects } from "./skill-check-sessions-effects";

describe("skillCheckSessionsEffects (session check writes)", () => {
    const T = {
        org: OrganizationId.create(),
        session: SkillCheckSessionId.create(),
        assessor: PersonId.create(),
        alice: PersonId.create(),
        bob: PersonId.create(),
        skill: SkillId.create(),
    };

    function makeCheck(
        assesseeId: PersonId,
        result: SkillCheckResultValue,
        notes = "",
    ): SkillCheck {
        return {
            id: SkillCheckId.create(),
            organizationId: T.org,
            sessionId: T.session,
            assesseeId,
            assessorId: T.assessor,
            assessorLabel: null,
            skillId: T.skill,
            result,
            notes,
            status: "Draft",
            createdAt: new Date(0).toISOString(),
        };
    }

    const ownKey = trpc.skillChecks.listSkillChecks.queryKey({
        organizationId: T.org,
        sessionId: T.session,
        ownChecksOnly: true,
    });

    /** Applies the one write effect in `effects` to `old`, as the effector would. */
    function applyWrite(effects: MutationEffect[], old: SkillCheck[] | undefined) {
        const writes = effects.filter((e) => e.type === "write");
        expect(writes).toHaveLength(1);
        const [effect] = writes;
        expect(effect.queryKey).toEqual(ownKey);
        return typeof effect.data === "function" ? effect.data(old) : effect.data;
    }

    const setVars = {
        organizationId: T.org,
        skillCheckSessionId: T.session,
        assesseeId: T.alice,
        skillId: T.skill,
        result: "Pass" as const,
        notes: "",
    };

    describe("setSessionSkillCheck", () => {
        it("replaces the row for the same assessee and skill", () => {
            const aliceBefore = makeCheck(T.alice, "Fail");
            const bob = makeCheck(T.bob, "Pass");
            const saved = { ...aliceBefore, result: "Pass" as const, notes: "better" };

            const next = applyWrite(
                skillCheckSessionsEffects.setSessionSkillCheck(setVars, saved),
                [aliceBefore, bob],
            );

            expect(next).toEqual([saved, bob]);
        });

        it("appends a row that wasn't in the list", () => {
            const bob = makeCheck(T.bob, "Pass");
            const saved = makeCheck(T.alice, "Pass");

            const next = applyWrite(
                skillCheckSessionsEffects.setSessionSkillCheck(setVars, saved),
                [bob],
            );

            expect(next).toEqual([bob, saved]);
        });

        it("leaves an uncached list uncached", () => {
            const saved = makeCheck(T.alice, "Pass");
            expect(
                applyWrite(
                    skillCheckSessionsEffects.setSessionSkillCheck(setVars, saved),
                    undefined,
                ),
            ).toBeUndefined();
        });
    });

    describe("deleteSessionSkillCheck", () => {
        it("removes the row for the assessee and skill", () => {
            const alice = makeCheck(T.alice, "Fail");
            const bob = makeCheck(T.bob, "Pass");

            const next = applyWrite(
                skillCheckSessionsEffects.deleteSessionSkillCheck({
                    organizationId: T.org,
                    skillCheckSessionId: T.session,
                    assesseeId: T.alice,
                    skillId: T.skill,
                }),
                [alice, bob],
            );

            expect(next).toEqual([bob]);
        });
    });

    it("invalidates the org's other skill-check lists but not the own-checks list", () => {
        const queryClient = new QueryClient();
        const sessionKey = trpc.skillChecks.listSkillChecks.queryKey({
            organizationId: T.org,
            sessionId: T.session,
        });
        const orgKey = trpc.skillChecks.listSkillChecks.queryKey({ organizationId: T.org });
        const recentKey = trpc.skillChecks.listRecentChecks.queryKey({ organizationId: T.org });
        const otherOrgKey = trpc.skillChecks.listSkillChecks.queryKey({
            organizationId: OrganizationId.create(),
        });
        for (const key of [ownKey, sessionKey, orgKey, recentKey, otherOrgKey]) {
            queryClient.setQueryData(key, []);
        }

        const effects = skillCheckSessionsEffects.setSessionSkillCheck(
            setVars,
            makeCheck(T.alice, "Pass"),
        );
        const matched = effects
            .filter((e) => e.type === "invalidate")
            .flatMap((e) => queryClient.getQueryCache().findAll(e.filter))
            .map((query) => query.queryKey);

        expect(matched).toHaveLength(3);
        expect(matched).toEqual(expect.arrayContaining([sessionKey, orgKey, recentKey]));
    });
});
