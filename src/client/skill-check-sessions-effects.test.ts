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
import { SkillCheckSessionId, type SkillCheckSession } from "@/lib/schemas/skill-check-session";
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
            updatedAt: new Date(0).toISOString(),
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

        it("returns the same list when no row matches", () => {
            const old = [makeCheck(T.bob, "Pass")];

            const next = applyWrite(
                skillCheckSessionsEffects.deleteSessionSkillCheck({
                    organizationId: T.org,
                    skillCheckSessionId: T.session,
                    assesseeId: T.alice,
                    skillId: T.skill,
                }),
                old,
            );

            expect(next).toBe(old);
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

describe("skillCheckSessionsEffects (session status changes)", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        session: SkillCheckSessionId.create(),
        otherSession: SkillCheckSessionId.create(),
    };

    const updated: SkillCheckSession = {
        id: T.session,
        organizationId: T.org,
        sessionNumber: 1,
        name: "Session 1",
        date: new Date(0).toISOString(),
        notes: "",
        status: "Draft",
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
    };

    /** Seeds one query per key and returns the keys each effect's invalidations match. */
    function invalidatedKeys(effects: MutationEffect[]) {
        const queryClient = new QueryClient();
        const keys = {
            sessionChecks: trpc.skillChecks.listSkillChecks.queryKey({
                organizationId: T.org,
                sessionId: T.session,
            }),
            ownSessionChecks: trpc.skillChecks.listSkillChecks.queryKey({
                organizationId: T.org,
                sessionId: T.session,
                ownChecksOnly: true,
            }),
            otherSessionChecks: trpc.skillChecks.listSkillChecks.queryKey({
                organizationId: T.org,
                sessionId: T.otherSession,
            }),
            sessions: trpc.skillCheckSessions.listSessions.queryKey({ organizationId: T.org }),
            matrix: trpc.skillChecks.getCompetencyMatrix.queryKey({ organizationId: T.org }),
            otherOrgSessions: trpc.skillCheckSessions.listSessions.queryKey({
                organizationId: T.otherOrg,
            }),
            otherOrgMatrix: trpc.skillChecks.getCompetencyMatrix.queryKey({
                organizationId: T.otherOrg,
            }),
        };
        for (const key of Object.values(keys)) queryClient.setQueryData(key, []);

        const matched = effects
            .filter((e) => e.type === "invalidate")
            .flatMap((e) => queryClient.getQueryCache().findAll(e.filter))
            .map((query) => query.queryKey);
        return Object.entries(keys)
            .filter(([, key]) => matched.some((m) => JSON.stringify(m) === JSON.stringify(key)))
            .map(([name]) => name)
            .sort();
    }

    /** Applies the `getSession` write in `effects` to `old`. */
    function applyGetSessionWrite(effects: MutationEffect[], old: unknown) {
        const writes = effects.filter((e) => e.type === "write");
        expect(writes).toHaveLength(1);
        const [effect] = writes;
        expect(effect.queryKey).toEqual(
            trpc.skillCheckSessions.getSession.queryKey({
                organizationId: T.org,
                skillCheckSessionId: T.session,
            }),
        );
        return typeof effect.data === "function" ? effect.data(old) : effect.data;
    }

    const expectedInvalidations = ["matrix", "ownSessionChecks", "sessionChecks", "sessions"];

    describe("reopenSession", () => {
        const effects = skillCheckSessionsEffects.reopenSession(
            { organizationId: T.org, skillCheckSessionId: T.session },
            { updated },
        );

        it("merges the reopened session into getSession, keeping its assessors", () => {
            const assessors = [{ id: PersonId.create(), name: "Assessor" }];
            const old = { ...updated, status: "Include" as const, assessors };

            expect(applyGetSessionWrite(effects, old)).toEqual({ ...updated, assessors });
            expect(applyGetSessionWrite(effects, undefined)).toBeUndefined();
        });

        it("invalidates the session's check lists, the sessions list and the competency matrix", () => {
            expect(invalidatedKeys(effects)).toEqual(expectedInvalidations);
        });
    });

    describe("approveSession", () => {
        it("invalidates the session's check lists, the sessions list and the competency matrix", () => {
            const effects = skillCheckSessionsEffects.approveSession(
                { organizationId: T.org, sessionId: T.session, includedCheckIds: [] },
                { updated: { ...updated, status: "Include" } },
            );

            expect(invalidatedKeys(effects)).toEqual(expectedInvalidations);
        });
    });

    describe("updateCheckExclusions", () => {
        it("invalidates only the session's check lists, including the own-checks list", () => {
            const effects = skillCheckSessionsEffects.updateCheckExclusions({
                organizationId: T.org,
                sessionId: T.session,
                changes: [],
            });

            expect(effects.filter((e) => e.type === "write")).toHaveLength(0);
            expect(invalidatedKeys(effects)).toEqual(["ownSessionChecks", "sessionChecks"]);
        });
    });
});
