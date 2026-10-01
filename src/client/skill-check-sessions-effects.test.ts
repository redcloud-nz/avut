/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { QueryClient } from "@tanstack/react-query";

import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import {
    SessionCheck,
    SkillCheck,
    SkillCheckId,
    SkillCheckResultValue,
} from "@/lib/schemas/skill-check";
import { SkillCheckSessionId, type SkillCheckSession } from "@/lib/schemas/skill-check-session";
import type { SessionChecksData } from "@/lib/session-checks-sync";
import { trpc } from "@/trpc/client";
import type { MutationEffect } from "@/trpc/mutation-effector";

import { skillCheckSessionsEffects } from "./skill-check-sessions-effects";

/** The write effects in `effects` that target exactly `queryKey`. */
function writesTo(effects: MutationEffect[], queryKey: readonly unknown[]) {
    return effects
        .filter((e) => e.type === "write")
        .filter((e) => JSON.stringify(e.queryKey) === JSON.stringify(queryKey));
}

/** Applies the one write effect in `effects` for `queryKey` to `old`, as the effector would. */
function applyWriteTo(effects: MutationEffect[], queryKey: readonly unknown[], old: unknown) {
    const writes = writesTo(effects, queryKey);
    expect(writes).toHaveLength(1);
    const [effect] = writes;
    return typeof effect.data === "function" ? effect.data(old) : effect.data;
}

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
            checkedAt: new Date(0).toISOString(),
            recordedAt: new Date(0).toISOString(),
        };
    }

    const ownKey = trpc.skillChecks.listSkillChecks.queryKey({
        organizationId: T.org,
        sessionId: T.session,
        ownChecksOnly: true,
    });

    const sessionChecksKey = trpc.skillCheckSessions.listSessionChecks.queryKey({
        organizationId: T.org,
        skillCheckSessionId: T.session,
    });

    /** Applies the one own-checks list write in `effects` to `old`, as the effector would. */
    function applyWrite(effects: MutationEffect[], old: SkillCheck[] | undefined) {
        return applyWriteTo(effects, ownKey, old);
    }

    function withNames(check: SkillCheck, name: string): SessionCheck {
        return {
            ...check,
            assesseeName: `${name} assessee`,
            skillName: `${name} skill`,
            assessorName: `${name} assessor`,
        };
    }

    function sessionData(checks: SessionCheck[]): SessionChecksData {
        return { checks, cursor: new Date(0).toISOString(), sessionStatus: "Draft" };
    }

    const deleteVars = {
        organizationId: T.org,
        skillCheckSessionId: T.session,
        assesseeId: T.alice,
        skillId: T.skill,
    };

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
                skillCheckSessionsEffects.deleteSessionSkillCheck(deleteVars, {
                    deleted: true,
                    check: { ...alice, status: "Deleted" },
                }),
                [alice, bob],
            );

            expect(next).toEqual([bob]);
        });

        it("returns the same list when no row matches", () => {
            const old = [makeCheck(T.bob, "Pass")];

            const next = applyWrite(
                skillCheckSessionsEffects.deleteSessionSkillCheck(deleteVars, {
                    deleted: false,
                    check: null,
                }),
                old,
            );

            expect(next).toBe(old);
        });

        it("keeps a row re-recorded on another device after the delete", () => {
            const alice = makeCheck(T.alice, "Fail");
            const bob = makeCheck(T.bob, "Pass");
            const rerecorded: SkillCheck = {
                ...alice,
                result: "Pass",
                recordedAt: new Date(1_000).toISOString(),
            };

            const next = applyWrite(
                skillCheckSessionsEffects.deleteSessionSkillCheck(deleteVars, {
                    deleted: true,
                    check: rerecorded,
                }),
                [alice, bob],
            );

            expect(next).toEqual([rerecorded, bob]);
        });
    });

    describe("session cache", () => {
        const later = new Date(1_000).toISOString();

        it("set merges the saved row over the cached one, keeping its names", () => {
            const before = withNames(makeCheck(T.alice, "Fail"), "alice");
            const other = withNames({ ...makeCheck(T.bob, "Pass"), assessorId: T.bob }, "bob");
            const saved: SkillCheck = {
                ...makeCheck(T.alice, "Pass"),
                id: before.id,
                recordedAt: later,
            };

            const next = applyWriteTo(
                skillCheckSessionsEffects.setSessionSkillCheck(setVars, saved),
                sessionChecksKey,
                sessionData([before, other]),
            ) as SessionChecksData;

            expect(next.checks).toEqual([withNames(saved, "alice"), other]);
            // Other assessors' rows are the same objects.
            expect(next.checks[1]).toBe(other);
        });

        it("set adds an unknown id with empty names", () => {
            const other = withNames({ ...makeCheck(T.bob, "Pass"), assessorId: T.bob }, "bob");
            const saved = makeCheck(T.alice, "Pass");

            const next = applyWriteTo(
                skillCheckSessionsEffects.setSessionSkillCheck(setVars, saved),
                sessionChecksKey,
                sessionData([other]),
            ) as SessionChecksData;

            expect(next.checks).toEqual([
                other,
                { ...saved, assesseeName: "", skillName: "", assessorName: "" },
            ]);
        });

        it("set keeps the cached data when the cached row is newer", () => {
            const saved = makeCheck(T.alice, "Pass");
            const newer = withNames({ ...saved, result: "Fail", recordedAt: later }, "alice");
            const old = sessionData([newer]);

            expect(
                applyWriteTo(
                    skillCheckSessionsEffects.setSessionSkillCheck(setVars, saved),
                    sessionChecksKey,
                    old,
                ),
            ).toBe(old);
        });

        it("set leaves an uncached session list uncached", () => {
            expect(
                applyWriteTo(
                    skillCheckSessionsEffects.setSessionSkillCheck(
                        setVars,
                        makeCheck(T.alice, "Pass"),
                    ),
                    sessionChecksKey,
                    undefined,
                ),
            ).toBeUndefined();
        });

        it("delete merges the tombstone over the cached live row", () => {
            const live = withNames(makeCheck(T.alice, "Pass"), "alice");
            const other = withNames({ ...makeCheck(T.bob, "Pass"), assessorId: T.bob }, "bob");
            const tombstone: SkillCheck = {
                ...makeCheck(T.alice, "Pass"),
                id: live.id,
                status: "Deleted",
                recordedAt: later,
            };

            const next = applyWriteTo(
                skillCheckSessionsEffects.deleteSessionSkillCheck(deleteVars, {
                    deleted: true,
                    check: tombstone,
                }),
                sessionChecksKey,
                sessionData([live, other]),
            ) as SessionChecksData;

            expect(next.checks).toEqual([withNames(tombstone, "alice"), other]);
        });

        it("delete adds a tombstone for an unknown id with empty names", () => {
            const tombstone: SkillCheck = { ...makeCheck(T.alice, "Pass"), status: "Deleted" };

            const next = applyWriteTo(
                skillCheckSessionsEffects.deleteSessionSkillCheck(deleteVars, {
                    deleted: true,
                    check: tombstone,
                }),
                sessionChecksKey,
                sessionData([]),
            ) as SessionChecksData;

            expect(next.checks).toEqual([
                { ...tombstone, assesseeName: "", skillName: "", assessorName: "" },
            ]);
        });

        it("delete leaves an uncached session list uncached", () => {
            expect(
                applyWriteTo(
                    skillCheckSessionsEffects.deleteSessionSkillCheck(deleteVars, {
                        deleted: true,
                        check: { ...makeCheck(T.alice, "Pass"), status: "Deleted" },
                    }),
                    sessionChecksKey,
                    undefined,
                ),
            ).toBeUndefined();
        });

        it("delete writes nothing to the session cache when nothing was deleted", () => {
            const effects = skillCheckSessionsEffects.deleteSessionSkillCheck(deleteVars, {
                deleted: false,
                check: null,
            });

            expect(writesTo(effects, sessionChecksKey)).toHaveLength(0);
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
            recentChecks: trpc.skillChecks.listRecentChecks.queryKey({ organizationId: T.org }),
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
        return applyWriteTo(
            effects,
            trpc.skillCheckSessions.getSession.queryKey({
                organizationId: T.org,
                skillCheckSessionId: T.session,
            }),
            old,
        );
    }

    /** Applies the session cache (`listSessionChecks`) write in `effects` to `old`. */
    function applySessionChecksWrite(effects: MutationEffect[], old: unknown) {
        return applyWriteTo(
            effects,
            trpc.skillCheckSessions.listSessionChecks.queryKey({
                organizationId: T.org,
                skillCheckSessionId: T.session,
            }),
            old,
        );
    }

    const sessionChecks: SessionChecksData = {
        checks: [],
        cursor: new Date(0).toISOString(),
        sessionStatus: "Draft",
    };

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

        it("sets the session cache's sessionStatus", () => {
            const old = { ...sessionChecks, sessionStatus: "Include" as const };

            expect(applySessionChecksWrite(effects, old)).toEqual(sessionChecks);
            expect(applySessionChecksWrite(effects, sessionChecks)).toBe(sessionChecks);
            expect(applySessionChecksWrite(effects, undefined)).toBeUndefined();
        });
    });

    describe("approveSession", () => {
        const effects = skillCheckSessionsEffects.approveSession(
            { organizationId: T.org, sessionId: T.session, includedCheckIds: [] },
            { updated: { ...updated, status: "Include" } },
        );

        it("invalidates the session's check lists, the sessions list and the competency matrix", () => {
            expect(invalidatedKeys(effects)).toEqual(expectedInvalidations);
        });

        it("sets the session cache's sessionStatus", () => {
            expect(applySessionChecksWrite(effects, sessionChecks)).toEqual({
                ...sessionChecks,
                sessionStatus: "Include",
            });
            expect(applySessionChecksWrite(effects, undefined)).toBeUndefined();
        });
    });

    describe("updateSession", () => {
        const vars = {
            organizationId: T.org,
            skillCheckSessionId: T.session,
            update: { name: updated.name, date: updated.date, notes: updated.notes },
        };

        it("invalidates only the sessions list when the date is unchanged", () => {
            const effects = skillCheckSessionsEffects.updateSession(vars, {
                updated,
                dateChanged: false,
            });

            expect(invalidatedKeys(effects)).toEqual(["sessions"]);
        });

        it("also invalidates the checkedAt readers when the date changed", () => {
            const effects = skillCheckSessionsEffects.updateSession(vars, {
                updated,
                dateChanged: true,
            });

            expect(invalidatedKeys(effects)).toEqual([
                "matrix",
                "ownSessionChecks",
                "recentChecks",
                "sessionChecks",
                "sessions",
            ]);
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
