/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { D4HNagRecipientId, D4HNagRuleId, D4HNagRunId } from "@/lib/schemas/d4h-nag";
import { OrganizationId } from "@/lib/schemas/organization";
import { ProviderCredentialId } from "@/lib/schemas/provider-credential";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import * as D4HNag from "./d4h-nag";
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

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Wed 4 Nov 2026, 13:00 NZDT: an hour after the rules' Wednesday 12:00 slot. */
const NOW = new Date("2026-11-04T00:00:00Z");
/** The Wednesday 12:00 NZDT slot, and the week before's. */
const SLOT = new Date("2026-11-03T23:00:00Z");
const PREVIOUS_SLOT = new Date("2026-10-27T23:00:00Z");

const D4H_TEAM = 101;

describe("d4h-nag-runner.runDue", () => {
    let db: PrismaClient;

    const token = D4HAccessToken_ServerOnly.schema.parse({
        id: ProviderCredentialId.create(),
        organizationId: OrganizationId.create(),
        userId: null,
        label: "Nag token",
        serverCode: "ap",
        token: "secret",
        metadata: { d4HTeams: [], d4HOrganisations: [] },
    });

    /** Every rule runnable, and D4H with no exercises in any window, so each run completes empty. */
    function makeDeps(overrides: Partial<Runner.RunnerDeps> = {}) {
        return {
            checkRunnable: vi.fn(async () => ({
                runnable: true as const,
                token,
                d4hTeamId: D4H_TEAM,
                timeZone: "Pacific/Auckland",
            })),
            fetchExercises: vi.fn(async () => []),
            fetchRequestedAttendance: vi.fn(async () => []),
            fetchMembersByIds: vi.fn(async () => []),
            fetchTeamDetail: vi.fn(async () => ({ subdomain: "alpha" })),
            sendEmail: vi.fn(async () => ({ ok: true as const })),
            sleep: vi.fn(async () => {}),
            createLinkToken: vi.fn(() => ({ token: "token", hash: "hash" })),
            ...overrides,
        } satisfies Runner.RunnerDeps;
    }

    /** An organization with one D4H-linked team, and the modules on or off in its settings. */
    async function seedOrg({ nag = true, d4h = true } = {}) {
        const organizationId = OrganizationId.create();
        const teamId = TeamId.create();
        await db.organization.create({
            data: {
                id: organizationId,
                name: `Org ${organizationId}`,
                slug: organizationId,
                createdAt: new Date(),
            },
        });
        const config = {
            "integrations.d4h.enabled": true,
            "modules.d4h.enabled": d4h,
            "modules.d4h-nag.enabled": nag,
        };
        for (const [key, value] of Object.entries(config)) {
            await db.organizationConfig.create({ data: { organizationId, key, value } });
        }
        await db.team.create({ data: { id: teamId, organizationId, name: "Alpha" } });
        await db.team_D4H.create({
            data: { teamId, d4hTeamId: D4H_TEAM, d4hTeamName: "D4H 101", d4hServerCode: "ap" },
        });
        return { organizationId, teamId };
    }

    /** A Wednesday 12:00 rule, last claimed for the week before's slot unless told otherwise. */
    async function seedRule(
        org: { organizationId: OrganizationId; teamId: TeamId },
        { enabled = true, lastScheduledFor = PREVIOUS_SLOT as Date | null } = {},
    ) {
        const id = D4HNagRuleId.create();
        await db.d4HNagRule.create({
            data: {
                id,
                organizationId: org.organizationId,
                teamId: org.teamId,
                weekday: 3,
                hour: 12,
                enabled,
                lastScheduledFor,
            },
        });
        return id;
    }

    async function seedRun(
        org: { organizationId: OrganizationId; teamId: TeamId },
        {
            startedAt,
            status = "Completed" as const,
        }: { startedAt: Date; status?: "Running" | "Completed" },
    ) {
        const id = D4HNagRunId.create();
        await db.d4HNagRun.create({
            data: {
                id,
                organizationId: org.organizationId,
                teamId: org.teamId,
                teamName: "Alpha",
                trigger: "Cron",
                dryRun: false,
                startedAt,
                windowStart: startedAt,
                windowEnd: new Date(startedAt.getTime() + DAY_MS),
                status,
            },
        });
        return id;
    }

    function runsOf(organizationId: OrganizationId) {
        return db.d4HNagRun.findMany({ where: { organizationId }, orderBy: { startedAt: "asc" } });
    }

    function resultFor(result: Runner.RunDueResult, organizationId: OrganizationId) {
        return result.organizations.find((org) => org.organizationId === organizationId);
    }

    beforeEach(() => {
        // Each test ticks the clock through its own rules, so each gets a fresh database.
        db = createMockPrisma();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("runs a due rule once, and a second tick in the same hour does nothing", async () => {
        const org = await seedOrg();
        const ruleId = await seedRule(org);
        const deps = makeDeps();

        const first = await Runner.runDue(db, NOW, deps);

        expect(resultFor(first, org.organizationId)).toMatchObject({
            outcome: "ran",
            runs: [{ ruleId, status: "Completed", error: null }],
        });
        const [run] = await runsOf(org.organizationId);
        expect(run).toMatchObject({
            ruleId,
            trigger: "Cron",
            dryRun: false,
            status: "Completed",
            windowStart: new Date(NOW.getTime() + HOUR_MS),
            windowEnd: new Date(SLOT.getTime() + DAY_MS),
        });
        const rule = await db.d4HNagRule.findUniqueOrThrow({ where: { id: ruleId } });
        expect(rule.lastScheduledFor).toEqual(SLOT);

        const second = await Runner.runDue(db, new Date(NOW.getTime() + 20 * 60 * 1000), deps);

        expect(resultFor(second, org.organizationId)).toEqual({
            organizationId: org.organizationId,
            outcome: "ran",
            runs: [],
        });
        expect(await runsOf(org.organizationId)).toHaveLength(1);
    });

    it("catches up on the latest slot after a skipped tick, and only that one", async () => {
        const org = await seedOrg();
        // Last claimed two weeks back: last week's tick and this week's 12:00 tick were missed.
        const ruleId = await seedRule(org, {
            lastScheduledFor: new Date(PREVIOUS_SLOT.getTime() - 7 * DAY_MS),
        });
        const late = new Date(SLOT.getTime() + 3 * HOUR_MS);

        await Runner.runDue(db, late, makeDeps());

        const runs = await runsOf(org.organizationId);
        expect(runs).toHaveLength(1);
        expect(runs[0]).toMatchObject({
            ruleId,
            // The window keeps this week's slot, clipped by the late start.
            windowStart: new Date(late.getTime() + HOUR_MS),
            windowEnd: new Date(SLOT.getTime() + DAY_MS),
        });
        const rule = await db.d4HNagRule.findUniqueOrThrow({ where: { id: ruleId } });
        expect(rule.lastScheduledFor).toEqual(SLOT);
    });

    it("doesn't fire a re-enabled rule's passed slot, but fires the next one", async () => {
        const org = await seedOrg();
        const ruleId = await seedRule(org, { enabled: false });
        const user = UserId.create();
        await db.user.create({ data: { id: user, name: "Ada Admin", email: "ada@example.com" } });
        const deps = makeDeps();

        // Disabled over this week's slot: the tick skips it.
        await Runner.runDue(db, NOW, deps);
        expect(await runsOf(org.organizationId)).toHaveLength(0);

        // Re-enabled after the slot: the edit claims the passed slot.
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(NOW.getTime() + 10 * 60 * 1000));
        const ctx = createOrganizationMockContext({
            organizationId: org.organizationId,
            user: { id: user, name: "Ada Admin", email: "ada@example.com" },
            prisma: db,
        });
        await D4HNag.updateRule(ctx, ruleId, { enabled: true });
        vi.useRealTimers();

        await Runner.runDue(db, new Date(NOW.getTime() + HOUR_MS), deps);
        expect(await runsOf(org.organizationId)).toHaveLength(0);

        await Runner.runDue(db, new Date(NOW.getTime() + 7 * DAY_MS), deps);
        const runs = await runsOf(org.organizationId);
        expect(runs).toHaveLength(1);
        expect(runs[0].ruleId).toBe(ruleId);
    });

    it("leaves a paused rule's slot unclaimed", async () => {
        const org = await seedOrg();
        const ruleId = await seedRule(org);
        const deps = makeDeps({
            checkRunnable: vi.fn(async () => ({
                runnable: false as const,
                reason: "no-token" as const,
            })),
        });

        await Runner.runDue(db, NOW, deps);

        expect(await runsOf(org.organizationId)).toHaveLength(0);
        const rule = await db.d4HNagRule.findUniqueOrThrow({ where: { id: ruleId } });
        expect(rule.lastScheduledFor).toEqual(PREVIOUS_SLOT);
    });

    it("skips orgs with the module off, or with D4H off, but still prunes their old runs", async () => {
        const nagOff = await seedOrg({ nag: false });
        const d4hOff = await seedOrg({ d4h: false });
        const kept: string[] = [];
        for (const org of [nagOff, d4hOff]) {
            await seedRule(org);
            await seedRun(org, { startedAt: new Date(NOW.getTime() - 91 * DAY_MS) });
            kept.push(await seedRun(org, { startedAt: new Date(NOW.getTime() - 89 * DAY_MS) }));
        }
        const deps = makeDeps();

        const result = await Runner.runDue(db, NOW, deps);

        for (const org of [nagOff, d4hOff]) {
            expect(resultFor(result, org.organizationId)).toEqual({
                organizationId: org.organizationId,
                outcome: "skipped",
            });
        }
        expect(deps.checkRunnable).not.toHaveBeenCalled();
        expect(result.pruned).toBe(2);
        const remaining = await db.d4HNagRun.findMany({ select: { id: true } });
        expect(remaining.map((run) => run.id).sort()).toEqual([...kept].sort());
    });

    it("fails a stuck Running run and releases its Pending claims", async () => {
        const org = await seedOrg({ nag: false });
        const stuck = await seedRun(org, {
            startedAt: new Date(NOW.getTime() - 20 * 60 * 1000),
            status: "Running",
        });
        const recent = await seedRun(org, {
            startedAt: new Date(NOW.getTime() - 5 * 60 * 1000),
            status: "Running",
        });
        const recipient = D4HNagRecipientId.create();
        const dedupeKey = `${org.organizationId}:${D4H_TEAM}:7:1`;
        await db.d4HNagRecipient.create({
            data: {
                id: recipient,
                organizationId: org.organizationId,
                runId: stuck,
                d4hTeamId: D4H_TEAM,
                d4hExerciseId: 7,
                exerciseTitle: "Exercise 7",
                exerciseStartsAt: new Date(NOW.getTime() + DAY_MS),
                d4hMemberId: 1,
                memberName: "Member 1",
                email: "one@example.com",
                outcome: "Pending",
                dedupeKey,
            },
        });

        const result = await Runner.runDue(db, NOW, makeDeps());

        expect(result.timedOut).toBe(1);
        expect(await db.d4HNagRun.findUniqueOrThrow({ where: { id: stuck } })).toMatchObject({
            status: "Failed",
            error: Runner.TIMED_OUT_ERROR,
            completedAt: NOW,
            failedCount: 1,
        });
        expect(
            await db.d4HNagRecipient.findUniqueOrThrow({ where: { id: recipient } }),
        ).toMatchObject({ outcome: "Failed", dedupeKey: null });
        expect(await db.d4HNagRun.findUniqueOrThrow({ where: { id: recent } })).toMatchObject({
            status: "Running",
        });
    });

    it("keeps going after an org fails", async () => {
        const failing = await seedOrg();
        const healthy = await seedOrg();
        const failingRule = await seedRule(failing);
        const healthyRule = await seedRule(healthy);
        const runnable = makeDeps().checkRunnable;
        const deps = makeDeps({
            checkRunnable: async (ctx, ruleId) => {
                if (ctx.organizationId === failing.organizationId) throw new Error("D4H is down");
                return runnable(ctx, ruleId);
            },
        });

        const result = await Runner.runDue(db, NOW, deps);

        expect(resultFor(result, failing.organizationId)).toEqual({
            organizationId: failing.organizationId,
            outcome: "failed",
            error: "D4H is down",
        });
        expect(resultFor(result, healthy.organizationId)).toMatchObject({
            outcome: "ran",
            runs: [{ ruleId: healthyRule, status: "Completed" }],
        });
        // The failing org's slot stays unclaimed, so the next tick retries it.
        const rule = await db.d4HNagRule.findUniqueOrThrow({ where: { id: failingRule } });
        expect(rule.lastScheduledFor).toEqual(PREVIOUS_SLOT);
    });
});
