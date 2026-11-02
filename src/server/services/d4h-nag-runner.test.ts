/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { ReactElement } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { render } from "@react-email/components";

import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { D4HNagOptOutId, D4HNagRuleId, D4HNagRunId } from "@/lib/schemas/d4h-nag";
import type { D4HActivity } from "@/lib/schemas/d4h/activity";
import type { D4HActivityAttendance } from "@/lib/schemas/d4h/activity-attendance";
import { OrganizationId } from "@/lib/schemas/organization";
import { ProviderCredentialId } from "@/lib/schemas/provider-credential";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";
import type { D4HMemberWithOptionalEmail } from "@/server/d4h-api/client";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import * as Runner from "./d4h-nag-runner";

// Every D4H call goes through the injected `RunnerDeps`; these keep the real token resolver and
// D4H client (and the real Prisma client behind them) out of the test.
vi.mock("@/server/d4h-access-token", () => ({
    getD4HNagAccessToken: vi.fn(),
    toD4HCredentialRef: vi.fn(),
}));

vi.mock("@/server/d4h-api/client", () => ({
    fetchD4HCurrentTeamMembers: vi.fn(),
    getD4HTokenMetadata: vi.fn(),
    fetchD4HExercisesStartingBetween: vi.fn(),
    fetchD4HRequestedAttendance: vi.fn(),
    fetchD4HMembersByIds: vi.fn(),
    fetchD4HTeamDetailCached: vi.fn(),
}));

describe("d4h-nag-runner", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: UserId.create(),
        teamA: TeamId.create(),
        teamB: TeamId.create(),
        teamOther: TeamId.create(),
        ruleA: D4HNagRuleId.create(),
        ruleB: D4HNagRuleId.create(),
        ruleOther: D4HNagRuleId.create(),
        ruleSlot: D4HNagRuleId.create(),
        ruleEdited: D4HNagRuleId.create(),
        ruleStartFails: D4HNagRuleId.create(),
        optOut: D4HNagOptOutId.create(),
    };

    /** Wed 4 Nov 2026, 13:00 NZDT. */
    const NOW = new Date("2026-11-04T00:00:00Z");
    /** The Wednesday 12:00 NZDT slot, and the week before's. */
    const SLOT = new Date("2026-11-03T23:00:00Z");
    const PREVIOUS_SLOT = new Date("2026-10-27T23:00:00Z");

    const D4H_TEAM = 101;

    const db = createMockPrisma();

    const token = D4HAccessToken_ServerOnly.schema.parse({
        id: ProviderCredentialId.create(),
        organizationId: T.org,
        userId: null,
        label: "Nag token",
        serverCode: "ap",
        token: "secret",
        metadata: { d4HTeams: [], d4HOrganisations: [] },
    });

    function exercise(id: number, title = `Exercise ${id}`): D4HActivity {
        return {
            id,
            reference: null,
            referenceDescription: title,
            startsAt: "2026-11-05T06:00:00Z",
            endsAt: "2026-11-05T09:00:00Z",
            address: null,
        };
    }

    function attending(exerciseId: number, memberId: number): D4HActivityAttendance {
        return {
            id: exerciseId * 1000 + memberId,
            resourceType: "ActivityAttendance",
            activity: { id: exerciseId, resourceType: "Exercise" },
            member: { id: memberId, resourceType: "Member" },
            status: "REQUESTED",
            startsAt: "2026-11-05T06:00:00Z",
            endsAt: "2026-11-05T09:00:00Z",
        };
    }

    /** Members 1, 5 and 6 have addresses; 2 has none, 4 a blank one; 3 is opted out on Bravo. */
    const MEMBERS: Record<number, string | null> = {
        1: "one@example.com",
        2: null,
        3: "three@example.com",
        4: "   ",
        5: "five@example.com",
        6: "six@example.com",
    };

    function member(id: number): D4HMemberWithOptionalEmail {
        const email = MEMBERS[id];
        return {
            id,
            resourceType: "Member",
            name: `Member ${id}`,
            email: email === null ? null : { value: email, verified: true },
            owner: { id: D4H_TEAM, resourceType: "Team" },
            position: null,
            ref: null,
            role: { id: null, resourceType: "Role" },
            status: "OPERATIONAL",
        };
    }

    /**
     * Fakes for one exercise and the given members, all `REQUESTED`. Each test uses its own
     * exercise id, so the dedupe keys of one test never meet another's.
     */
    function makeDeps(
        exerciseId: number,
        memberIds: number[],
        overrides: Partial<Runner.RunnerDeps> = {},
    ) {
        let tokens = 0;
        return {
            checkRunnable: vi.fn(async () => ({
                runnable: true as const,
                token,
                d4hTeamId: D4H_TEAM,
                timeZone: "Pacific/Auckland",
            })),
            fetchExercises: vi.fn(async () => [exercise(exerciseId)]),
            fetchRequestedAttendance: vi.fn(async () =>
                memberIds.map((memberId) => attending(exerciseId, memberId)),
            ),
            fetchMembersByIds: vi.fn(async (_token, _team, ids: readonly number[]) =>
                ids.map(member),
            ),
            fetchTeamDetail: vi.fn(async () => ({ subdomain: "alpha" })),
            sendEmail: vi.fn(async () => ({ ok: true as const })),
            sleep: vi.fn(async () => {}),
            createLinkToken: vi.fn(() => {
                tokens++;
                return {
                    token: `token-${exerciseId}-${tokens}`,
                    hash: `hash-${exerciseId}-${tokens}`,
                };
            }),
            ...overrides,
        } satisfies Runner.RunnerDeps;
    }

    /** Fail the next `times` updates that record a recipient as `Sent`; other updates go through. */
    function failSentUpdates(times: number) {
        const original = db.d4HNagRecipient.update.bind(db.d4HNagRecipient);
        let left = times;
        return vi.spyOn(db.d4HNagRecipient, "update").mockImplementation(((
            args: Parameters<typeof original>[0],
        ) => {
            if (left > 0 && args.data.outcome === "Sent") {
                left--;
                return Promise.reject(new Error("Database is down"));
            }
            return original(args);
        }) as never);
    }

    const cronOptions = { trigger: "Cron" as const, dryRun: false, now: NOW, slot: SLOT };

    function cronCtx(organizationId: OrganizationId = T.org) {
        return { prisma: db, organizationId };
    }

    function userCtx() {
        return createOrganizationMockContext({
            organizationId: T.org,
            user: { id: T.user, name: "Ada Admin", email: "ada@example.com" },
            prisma: db,
        });
    }

    async function recipientsOf(runId: string) {
        const rows = await db.d4HNagRecipient.findMany({ where: { runId } });
        return new Map(rows.map((row) => [row.d4hMemberId, row]));
    }

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: `Org ${id}`, slug: id, createdAt: new Date() },
            });
            await db.organizationConfig.create({
                data: { organizationId: id, key: "integrations.d4h.enabled", value: true },
            });
        }
        await db.organizationConfig.create({
            data: { organizationId: T.org, key: "general.replyTo", value: "leaders@example.org" },
        });
        await db.user.create({
            data: { id: T.user, name: "Ada Admin", email: "ada@example.com" },
        });

        // Alpha and Bravo (one org) and Other (another org) all link to the same D4H team.
        const teams = [
            { id: T.teamA, organizationId: T.org, name: "Alpha" },
            { id: T.teamB, organizationId: T.org, name: "Bravo" },
            { id: T.teamOther, organizationId: T.otherOrg, name: "Other" },
        ];
        for (const team of teams) {
            await db.team.create({ data: team });
            await db.team_D4H.create({
                data: {
                    teamId: team.id,
                    d4hTeamId: D4H_TEAM,
                    d4hTeamName: "D4H 101",
                    d4hServerCode: "ap",
                },
            });
        }

        const rules = [
            { id: T.ruleA, organizationId: T.org, teamId: T.teamA, message: "Bring boots" },
            { id: T.ruleB, organizationId: T.org, teamId: T.teamB },
            { id: T.ruleOther, organizationId: T.otherOrg, teamId: T.teamOther },
            { id: T.ruleSlot, organizationId: T.org, teamId: T.teamA, lastScheduledFor: SLOT },
            { id: T.ruleEdited, organizationId: T.org, teamId: T.teamA, lastScheduledFor: SLOT },
            {
                id: T.ruleStartFails,
                organizationId: T.org,
                teamId: T.teamA,
                lastScheduledFor: SLOT,
            },
        ];
        for (const rule of rules) {
            await db.d4HNagRule.create({ data: { weekday: 3, hour: 12, ...rule } });
        }

        // Member 3 opted out on Bravo; Alpha's rules skip them too (decision 19).
        await db.d4HNagOptOut.create({
            data: {
                id: T.optOut,
                organizationId: T.org,
                teamId: T.teamB,
                d4hMemberId: 3,
                memberName: "Member 3",
                source: "Self",
            },
        });
    });

    describe("startRun", () => {
        it("records a Running run with the team and the scheduled window", async () => {
            const runId = await Runner.startRun(cronCtx(), T.ruleA, cronOptions);

            const run = await db.d4HNagRun.findUniqueOrThrow({ where: { id: runId } });
            expect(run).toMatchObject({
                status: "Running",
                ruleId: T.ruleA,
                teamId: T.teamA,
                teamName: "Alpha",
                trigger: "Cron",
                dryRun: false,
                // [max(now, slot) + 1h, slot + 24h]
                windowStart: new Date("2026-11-04T01:00:00Z"),
                windowEnd: new Date("2026-11-04T23:00:00Z"),
            });
        });

        it("refuses a rule in another organization", async () => {
            await expect(Runner.startRun(cronCtx(), T.ruleOther, cronOptions)).rejects.toThrow(
                /not found/,
            );
        });
    });

    describe("executeRun", () => {
        it("records every outcome, in order, and completes with the counts", async () => {
            const sendEmail = vi
                .fn<Runner.RunnerDeps["sendEmail"]>()
                .mockResolvedValueOnce({ ok: true })
                .mockResolvedValueOnce({ ok: false, error: new Error("Resend said no") });
            const deps = makeDeps(500, [1, 2, 3, 4, 5], { sendEmail });

            const result = await Runner.runRule(cronCtx(), T.ruleA, cronOptions, deps);

            expect(result).toMatchObject({ status: "Completed", sendAttempted: true });
            const rows = await recipientsOf(result.runId);
            expect(rows.get(1)).toMatchObject({
                outcome: "Sent",
                email: "one@example.com",
                tokenHash: "hash-500-1",
                dedupeKey: `${T.org}:${D4H_TEAM}:500:1`,
                exerciseTitle: "Exercise 500",
            });
            // A null email is a skip, not a failure of the run.
            expect(rows.get(2)).toMatchObject({ outcome: "SkippedNoEmail", email: null });
            expect(rows.get(3)).toMatchObject({ outcome: "SkippedOptedOut" });
            expect(rows.get(4)).toMatchObject({ outcome: "SkippedNoEmail", email: null });
            expect(rows.get(5)).toMatchObject({
                outcome: "Failed",
                dedupeKey: null,
                tokenHash: null,
            });

            const run = await db.d4HNagRun.findUniqueOrThrow({ where: { id: result.runId } });
            expect(run).toMatchObject({
                status: "Completed",
                exercisesFound: 1,
                sentCount: 1,
                skippedCount: 3,
                failedCount: 1,
            });
            expect(run.completedAt).not.toBeNull();

            // Two sends, spaced once.
            expect(sendEmail).toHaveBeenCalledTimes(2);
            expect(deps.sleep).toHaveBeenCalledExactlyOnceWith(Runner.SEND_SPACING_MS);
        });

        it("addresses the email with the org's Reply-To and the opt-out link", async () => {
            const deps = makeDeps(501, [1]);

            await Runner.runRule(cronCtx(), T.ruleA, cronOptions, deps);

            expect(deps.sendEmail).toHaveBeenCalledExactlyOnceWith(
                expect.objectContaining({
                    to: "one@example.com",
                    replyTo: "leaders@example.org",
                    subject: expect.stringMatching(/^Are you coming to Exercise 501\?/),
                }),
            );
            const [payload] = vi.mocked(deps.sendEmail).mock.calls[0] as unknown as [
                { react: ReactElement },
            ];
            const text = await render(payload.react, { plainText: true });
            expect(text).toContain("Bring boots");
            expect(text).toContain("/public/d4h-nag/opt-out/token-501-1");
            expect(text).toContain("https://alpha.team-manager.ap.d4h.com/team/exercises/view/501");
        });

        it("reminds a member once across two rules for the same D4H team", async () => {
            const deps = makeDeps(502, [1]);

            const first = await Runner.runRule(cronCtx(), T.ruleA, cronOptions, deps);
            const second = await Runner.runRule(cronCtx(), T.ruleB, cronOptions, deps);

            expect((await recipientsOf(first.runId)).get(1)?.outcome).toBe("Sent");
            const skipped = (await recipientsOf(second.runId)).get(1);
            expect(skipped).toMatchObject({ outcome: "SkippedAlreadyReminded", dedupeKey: null });
            expect(deps.sendEmail).toHaveBeenCalledOnce();
        });

        it("doesn't dedupe across two orgs linked to the same D4H team", async () => {
            const deps = makeDeps(503, [1]);

            const ours = await Runner.runRule(cronCtx(), T.ruleA, cronOptions, deps);
            const theirs = await Runner.runRule(
                cronCtx(T.otherOrg),
                T.ruleOther,
                cronOptions,
                deps,
            );

            expect((await recipientsOf(ours.runId)).get(1)?.outcome).toBe("Sent");
            expect((await recipientsOf(theirs.runId)).get(1)?.outcome).toBe("Sent");
            expect(deps.sendEmail).toHaveBeenCalledTimes(2);
        });

        it("skips a member opted out on another AVUT team linked to the same D4H team", async () => {
            const deps = makeDeps(504, [3]);

            const result = await Runner.runRule(cronCtx(), T.ruleA, cronOptions, deps);

            expect((await recipientsOf(result.runId)).get(3)?.outcome).toBe("SkippedOptedOut");
            expect(deps.sendEmail).not.toHaveBeenCalled();
        });

        it("retries a member whose send failed", async () => {
            const sendEmail = vi
                .fn<Runner.RunnerDeps["sendEmail"]>()
                .mockResolvedValueOnce({ ok: false, error: new Error("down") })
                .mockResolvedValueOnce({ ok: true });
            const deps = makeDeps(505, [1], { sendEmail });

            const first = await Runner.runRule(cronCtx(), T.ruleA, cronOptions, deps);
            const second = await Runner.runRule(cronCtx(), T.ruleA, cronOptions, deps);

            expect((await recipientsOf(first.runId)).get(1)?.outcome).toBe("Failed");
            expect((await recipientsOf(second.runId)).get(1)).toMatchObject({
                outcome: "Sent",
                dedupeKey: `${T.org}:${D4H_TEAM}:505:1`,
            });
        });

        it("a dry run after a real run reports SkippedAlreadyReminded, claiming and sending nothing", async () => {
            await Runner.runRule(cronCtx(), T.ruleA, cronOptions, makeDeps(506, [1]));
            const deps = makeDeps(506, [1, 6]);

            const result = await Runner.runRule(
                userCtx(),
                T.ruleA,
                { trigger: "Manual", dryRun: true, now: NOW, startedById: T.user },
                deps,
            );

            const rows = await recipientsOf(result.runId);
            expect(rows.get(1)).toMatchObject({
                outcome: "SkippedAlreadyReminded",
                dedupeKey: null,
                tokenHash: null,
            });
            expect(rows.get(6)).toMatchObject({
                outcome: "DryRun",
                dedupeKey: null,
                tokenHash: null,
            });
            expect(deps.sendEmail).not.toHaveBeenCalled();
            expect(deps.createLinkToken).not.toHaveBeenCalled();

            const run = await db.d4HNagRun.findUniqueOrThrow({ where: { id: result.runId } });
            expect(run).toMatchObject({ status: "Completed", dryRun: true, logBatchId: null });
        });

        it("completes a run whose window is empty with zero exercises", async () => {
            const deps = makeDeps(507, [1]);
            // A catch-up 23½ hours late: nothing in the window is still an hour away.
            const late = new Date(SLOT.getTime() + 23.5 * 60 * 60 * 1000);

            const result = await Runner.runRule(
                cronCtx(),
                T.ruleA,
                { ...cronOptions, now: late },
                deps,
            );

            const run = await db.d4HNagRun.findUniqueOrThrow({ where: { id: result.runId } });
            expect(run).toMatchObject({ status: "Completed", exercisesFound: 0, sentCount: 0 });
            expect(deps.fetchExercises).not.toHaveBeenCalled();
        });

        it("does nothing to a run that isn't Running", async () => {
            const deps = makeDeps(508, [1]);
            const done = await Runner.runRule(cronCtx(), T.ruleA, cronOptions, deps);

            const again = await Runner.executeRun(cronCtx(), done.runId, deps);

            expect(again.status).toBe("Completed");
            expect(deps.sendEmail).toHaveBeenCalledOnce();
        });

        it("refuses a run in another organization", async () => {
            await expect(
                Runner.executeRun(cronCtx(T.otherOrg), D4HNagRunId.create(), makeDeps(509, [])),
            ).rejects.toThrow(/not found/);
        });
    });

    describe("failures", () => {
        it("records a D4H failure on the run and releases the slot", async () => {
            const deps = makeDeps(510, [1], {
                fetchExercises: vi.fn(async () => {
                    throw new Error("D4H is down");
                }),
            });

            const result = await Runner.runRule(
                cronCtx(),
                T.ruleSlot,
                { ...cronOptions, previousLastScheduledFor: PREVIOUS_SLOT },
                deps,
            );

            expect(result).toMatchObject({ status: "Failed", sendAttempted: false });
            const run = await db.d4HNagRun.findUniqueOrThrow({ where: { id: result.runId } });
            expect(run).toMatchObject({ status: "Failed", error: "D4H is down" });
            const rule = await db.d4HNagRule.findUniqueOrThrow({ where: { id: T.ruleSlot } });
            expect(rule.lastScheduledFor).toEqual(PREVIOUS_SLOT);
        });

        it("leaves a slot reset by an edit made during the run alone", async () => {
            const edited = new Date("2026-11-04T00:00:00Z");
            const deps = makeDeps(511, [1], {
                fetchExercises: vi.fn(async () => {
                    // An admin changes the schedule while the run is in flight.
                    await db.d4HNagRule.update({
                        where: { id: T.ruleEdited },
                        data: { lastScheduledFor: edited },
                    });
                    throw new Error("D4H is down");
                }),
            });

            await Runner.runRule(
                cronCtx(),
                T.ruleEdited,
                { ...cronOptions, previousLastScheduledFor: PREVIOUS_SLOT },
                deps,
            );

            const rule = await db.d4HNagRule.findUniqueOrThrow({ where: { id: T.ruleEdited } });
            expect(rule.lastScheduledFor).toEqual(edited);
        });

        it("releases the slot and rethrows when the run can't be started", async () => {
            const create = vi
                .spyOn(db.d4HNagRun, "create")
                .mockRejectedValueOnce(new Error("Database is down"));
            const deps = makeDeps(513, [1]);

            try {
                await expect(
                    Runner.runRule(
                        cronCtx(),
                        T.ruleStartFails,
                        { ...cronOptions, previousLastScheduledFor: PREVIOUS_SLOT },
                        deps,
                    ),
                ).rejects.toThrow("Database is down");
            } finally {
                create.mockRestore();
            }

            const rule = await db.d4HNagRule.findUniqueOrThrow({
                where: { id: T.ruleStartFails },
            });
            expect(rule.lastScheduledFor).toEqual(PREVIOUS_SLOT);
            expect(deps.checkRunnable).not.toHaveBeenCalled();
        });

        it("retries recording a sent email once", async () => {
            const update = failSentUpdates(1);
            const deps = makeDeps(514, [1]);

            try {
                const result = await Runner.runRule(cronCtx(), T.ruleA, cronOptions, deps);
                expect(result.status).toBe("Completed");
                expect((await recipientsOf(result.runId)).get(1)?.outcome).toBe("Sent");
            } finally {
                update.mockRestore();
            }
        });

        it("keeps the claim of a sent email it couldn't record, so it isn't sent again", async () => {
            const update = failSentUpdates(2);
            const deps = makeDeps(515, [1, 5]);

            let first: Runner.RunResult;
            try {
                first = await Runner.runRule(cronCtx(), T.ruleA, cronOptions, deps);
            } finally {
                update.mockRestore();
            }

            expect(first).toMatchObject({ status: "Failed", sendAttempted: true });
            // The link token went on with the claim, so the email's opt-out link still works.
            expect((await recipientsOf(first.runId)).get(1)).toMatchObject({
                outcome: "Pending",
                dedupeKey: `${T.org}:${D4H_TEAM}:515:1`,
                tokenHash: "hash-515-1",
            });
            const run = await db.d4HNagRun.findUniqueOrThrow({ where: { id: first.runId } });
            expect(run).toMatchObject({ status: "Failed", sentCount: 1 });

            const second = await Runner.runRule(cronCtx(), T.ruleA, cronOptions, deps);
            const rows = await recipientsOf(second.runId);
            expect(rows.get(1)?.outcome).toBe("SkippedAlreadyReminded");
            expect(rows.get(5)?.outcome).toBe("Sent");
            // Member 1 once, in the first run; member 5 only in the second.
            expect(deps.sendEmail).toHaveBeenCalledTimes(2);
        });

        it("fails a paused rule's run with the reason", async () => {
            const deps = makeDeps(512, [1], {
                checkRunnable: vi.fn(async () => ({
                    runnable: false as const,
                    reason: "no-token" as const,
                })),
            });

            const result = await Runner.runRule(cronCtx(), T.ruleA, cronOptions, deps);

            expect(result.status).toBe("Failed");
            expect(result.error).toContain("no-token");
            expect(deps.fetchExercises).not.toHaveBeenCalled();
        });
    });

    describe("audit", () => {
        it("logs a cron run actor-less under its batch", async () => {
            const result = await Runner.runRule(
                cronCtx(),
                T.ruleA,
                cronOptions,
                makeDeps(520, [1]),
            );

            const run = await db.d4HNagRun.findUniqueOrThrow({ where: { id: result.runId } });
            expect(run.logBatchId).not.toBeNull();
            const entry = await db.logEntry.findFirstOrThrow({
                where: { batchId: run.logBatchId },
            });
            expect(entry).toMatchObject({
                action: "Run",
                objectType: "D4HNagRule",
                objectId: T.ruleA,
                userId: null,
                actorLabel: Runner.CRON_ACTOR_LABEL,
                description: "Alpha: 1 exercise, 1 sent, 0 skipped, 0 failed",
            });
            const batch = await db.logBatch.findUniqueOrThrow({ where: { id: run.logBatchId! } });
            expect(batch).toMatchObject({
                operationKey: "d4h-nag-run",
                userId: null,
                actorLabel: Runner.CRON_ACTOR_LABEL,
            });
        });

        it("logs a real run that failed after sending, with the error", async () => {
            const update = failSentUpdates(2);
            let result: Runner.RunResult;
            try {
                result = await Runner.runRule(cronCtx(), T.ruleA, cronOptions, makeDeps(521, [1]));
            } finally {
                update.mockRestore();
            }

            expect(result).toMatchObject({ status: "Failed", sendAttempted: true });
            const run = await db.d4HNagRun.findUniqueOrThrow({ where: { id: result.runId } });
            expect(run.logBatchId).not.toBeNull();
            const entry = await db.logEntry.findFirstOrThrow({
                where: { batchId: run.logBatchId },
            });
            expect(entry).toMatchObject({
                action: "Run",
                objectType: "D4HNagRule",
                objectId: T.ruleA,
            });
            expect(entry.description).toContain("1 sent");
            expect(entry.description).toContain("failed: Database is down");
        });

        it("doesn't log a run that failed before sending anything", async () => {
            const result = await Runner.runRule(
                cronCtx(),
                T.ruleA,
                cronOptions,
                makeDeps(522, [1], {
                    fetchExercises: vi.fn(async () => {
                        throw new Error("D4H is down");
                    }),
                }),
            );

            expect(result).toMatchObject({ status: "Failed", sendAttempted: false });
            const run = await db.d4HNagRun.findUniqueOrThrow({ where: { id: result.runId } });
            expect(run.logBatchId).toBeNull();
        });

        it("logs a manual run as the user who started it", async () => {
            const result = await Runner.runRule(
                userCtx(),
                T.ruleA,
                { trigger: "Manual", dryRun: false, now: NOW, startedById: T.user },
                makeDeps(521, [1]),
            );

            const run = await db.d4HNagRun.findUniqueOrThrow({ where: { id: result.runId } });
            expect(run).toMatchObject({ trigger: "Manual", startedById: T.user });
            const entry = await db.logEntry.findFirstOrThrow({
                where: { batchId: run.logBatchId },
            });
            expect(entry).toMatchObject({ action: "Run", objectId: T.ruleA, userId: T.user });
            const batch = await db.logBatch.findUniqueOrThrow({ where: { id: run.logBatchId! } });
            expect(batch).toMatchObject({ operationKey: "d4h-nag-run", userId: T.user });
        });
    });
});
