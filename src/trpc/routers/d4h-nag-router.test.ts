/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Permissions } from "@/lib/permissions";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import {
    D4HNagOptOutId,
    D4HNagRecipientId,
    D4HNagRuleId,
    D4HNagRunId,
} from "@/lib/schemas/d4h-nag";
import { OrganizationId } from "@/lib/schemas/organization";
import { ProviderCredentialId } from "@/lib/schemas/provider-credential";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";
import { getD4HNagAccessToken } from "@/server/d4h-access-token";
import { fetchD4HCurrentTeamMembers, getD4HTokenMetadata } from "@/server/d4h-api/client";
import { hashLinkToken } from "@/server/link-token";
import { resolveModuleFlags } from "@/server/module-flags";
import { executeRun } from "@/server/services/d4h-nag-runner";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { d4hNagRouter } from "./d4h-nag-router";

// `runRule` hands the rest of the run to `after()`; capture the callback instead of running it.
const afterCallbacks: (() => Promise<void>)[] = [];
vi.mock("next/server", () => ({
    after: (callback: () => Promise<void>) => afterCallbacks.push(callback),
}));

// The real `startRun`, but no run is executed: that's the runner's own tests' job.
vi.mock("@/server/services/d4h-nag-runner", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/server/services/d4h-nag-runner")>();
    return { ...actual, executeRun: vi.fn() };
});

// Every D4H call the router reaches goes through these; they keep the real token resolver and
// D4H client (and the real Prisma client behind them) out of the test.
vi.mock("@/server/d4h-access-token", () => ({
    getD4HNagAccessToken: vi.fn(),
    toD4HCredentialRef: vi.fn(),
}));

// The Vercel flags, evaluated outside any deployment here; every module's flag is on by default.
vi.mock("@/server/module-flags", () => ({ resolveModuleFlags: vi.fn() }));

vi.mock("@/server/d4h-api/client", () => ({
    fetchD4HCurrentTeamMembers: vi.fn(),
    getD4HTokenMetadata: vi.fn(),
    fetchD4HExercisesStartingBetween: vi.fn(),
    fetchD4HRequestedAttendance: vi.fn(),
    fetchD4HMembersByIds: vi.fn(),
    fetchD4HTeamDetailCached: vi.fn(),
}));

// `organizationProcedure` always folds in `organization: ["view"]`, and the mock's
// `hasPermission` checks statements literally, so each fixture spells out its grants.
const ADMIN: Permissions = { organization: ["view"], d4hNag: ["view", "update", "run"] };
const MEMBER: Permissions = { organization: ["view"] };

describe("d4hNagRouter", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        admin: UserId.create(),
        member: UserId.create(),
        teamA: TeamId.create(),
        teamB: TeamId.create(),
        teamOther: TeamId.create(),
        /** Once linked to D4H team 303, now linked to nothing. */
        teamUnlinked: TeamId.create(),
        /** Now linked to D4H team 303. */
        teamRelinked: TeamId.create(),
        ruleRunnable: D4HNagRuleId.create(),
        rulePaused: D4HNagRuleId.create(),
        ruleToDelete: D4HNagRuleId.create(),
        runA: D4HNagRunId.create(),
        runB: D4HNagRunId.create(),
        runUnlinked: D4HNagRunId.create(),
        optOutCrossTeam: D4HNagOptOutId.create(),
        optOutOtherOrg: D4HNagOptOutId.create(),
    };

    /** Mia (55) and Cal (77) were reminded on teamA's run, Noah (66) on teamB's. */
    const TOKEN = {
        mia: "token-mia",
        cal: "token-cal",
        noah: "token-noah",
        /** Reminded on teamUnlinked's run, for D4H team 303, now linked to teamRelinked. */
        ivy: "token-ivy",
        /** Reminded on teamUnlinked's run, for D4H team 404, which no team is linked to now. */
        owen: "token-owen",
    };

    const db = createMockPrisma();

    const token = D4HAccessToken_ServerOnly.schema.parse({
        id: ProviderCredentialId.create(),
        organizationId: T.org,
        userId: null,
        label: "Nag token",
        access: "ReadOnly",
        serverCode: "ap",
        token: "secret",
        metadata: { d4HTeams: [], d4HOrganisations: [] },
    });

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: `Org ${id}`, slug: id, createdAt: new Date() },
            });
            await db.organizationConfig.create({
                data: { organizationId: id, key: "integrations.d4h.enabled", value: true },
            });
        }
        // The module is on in T.org only.
        for (const key of ["modules.d4h.enabled", "modules.d4h-nag.enabled"]) {
            await db.organizationConfig.create({
                data: { organizationId: T.org, key, value: true },
            });
        }
        for (const id of [T.admin, T.member]) {
            await db.user.create({ data: { id, name: id, email: `${id}@example.com` } });
        }

        const teams = [
            { id: T.teamA, organizationId: T.org, name: "Alpha" },
            { id: T.teamB, organizationId: T.org, name: "Bravo" },
            { id: T.teamOther, organizationId: T.otherOrg, name: "Other" },
        ];
        for (const team of teams) {
            await db.team.create({ data: team });
            // All three link to the same D4H team.
            await db.team_D4H.create({
                data: {
                    teamId: team.id,
                    d4hTeamId: 101,
                    d4hTeamName: "D4H 101",
                    d4hServerCode: "ap",
                },
            });
        }
        await db.team.create({
            data: { id: T.teamUnlinked, organizationId: T.org, name: "Unlinked" },
        });
        await db.team.create({
            data: { id: T.teamRelinked, organizationId: T.org, name: "Relinked" },
        });
        await db.team_D4H.create({
            data: {
                teamId: T.teamRelinked,
                d4hTeamId: 303,
                d4hTeamName: "D4H 303",
                d4hServerCode: "ap",
            },
        });

        const rules = [
            { id: T.ruleRunnable, teamId: T.teamA },
            { id: T.rulePaused, teamId: T.teamA, enabled: false },
            { id: T.ruleToDelete, teamId: T.teamB },
        ];
        for (const rule of rules) {
            await db.d4HNagRule.create({
                data: { organizationId: T.org, weekday: 1, hour: 19, ...rule },
            });
        }

        const runs = [
            { id: T.runA, ruleId: T.ruleRunnable, teamId: T.teamA, teamName: "Alpha" },
            { id: T.runB, ruleId: T.ruleToDelete, teamId: T.teamB, teamName: "Bravo" },
            { id: T.runUnlinked, ruleId: null, teamId: T.teamUnlinked, teamName: "Unlinked" },
        ];
        for (const run of runs) {
            await db.d4HNagRun.create({
                data: {
                    organizationId: T.org,
                    trigger: "Cron",
                    dryRun: false,
                    status: "Completed",
                    windowStart: new Date(),
                    windowEnd: new Date(),
                    ...run,
                },
            });
        }

        const recipients = [
            { runId: T.runA, d4hMemberId: 55, memberName: "Mia", token: TOKEN.mia },
            { runId: T.runA, d4hMemberId: 77, memberName: "Cal", token: TOKEN.cal },
            { runId: T.runB, d4hMemberId: 66, memberName: "Noah", token: TOKEN.noah },
            {
                runId: T.runUnlinked,
                d4hTeamId: 303,
                d4hMemberId: 88,
                memberName: "Ivy",
                token: TOKEN.ivy,
            },
            {
                runId: T.runUnlinked,
                d4hTeamId: 404,
                d4hMemberId: 99,
                memberName: "Owen",
                token: TOKEN.owen,
            },
        ];
        for (const { token: plain, ...recipient } of recipients) {
            await db.d4HNagRecipient.create({
                data: {
                    id: D4HNagRecipientId.create(),
                    organizationId: T.org,
                    d4hTeamId: 101,
                    d4hExerciseId: 1,
                    exerciseTitle: "Training",
                    exerciseStartsAt: new Date(),
                    email: "m@example.com",
                    outcome: "Sent",
                    tokenHash: hashLinkToken(plain),
                    ...recipient,
                },
            });
        }

        // Cal is already opted out by an admin on teamB, linked to the same D4H team as teamA;
        // the same member id is opted out in another org too.
        await db.d4HNagOptOut.create({
            data: {
                id: T.optOutCrossTeam,
                organizationId: T.org,
                teamId: T.teamB,
                d4hMemberId: 77,
                memberName: "Cal",
                source: "Admin",
                createdById: T.admin,
            },
        });
        await db.d4HNagOptOut.create({
            data: {
                id: T.optOutOtherOrg,
                organizationId: T.otherOrg,
                teamId: T.teamOther,
                d4hMemberId: 77,
                memberName: "Cal",
                source: "Self",
            },
        });
    });

    beforeEach(() => {
        afterCallbacks.length = 0;
        vi.mocked(resolveModuleFlags).mockResolvedValue({
            "d4h-nag": true,
        } as Awaited<ReturnType<typeof resolveModuleFlags>>);
        vi.mocked(getD4HNagAccessToken).mockResolvedValue(token);
        vi.mocked(getD4HTokenMetadata).mockResolvedValue({
            d4HTeams: [{ id: 101, title: "D4H 101", resourceType: "Team", permissions: {} }],
            d4HOrganisations: [],
        } as Awaited<ReturnType<typeof getD4HTokenMetadata>>);
        vi.mocked(fetchD4HCurrentTeamMembers).mockResolvedValue([
            { id: 2, name: "Zed" },
            { id: 1, name: "Ann" },
        ] as Awaited<ReturnType<typeof fetchD4HCurrentTeamMembers>>);
    });

    function makeCaller(userId: UserId, permissions: Permissions) {
        return d4hNagRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: userId }, permissions, prisma: db }),
        );
    }

    function anonymous() {
        return d4hNagRouter.createCaller({
            ...createAuthenticatedMockContext({ user: { id: UserId.create() }, prisma: db }),
            auth: null,
        });
    }

    describe("permissions", () => {
        const org = { organizationId: T.org };
        const calls: [string, (caller: ReturnType<typeof makeCaller>) => Promise<unknown>][] = [
            [
                "addOptOut",
                (c) => c.addOptOut({ ...org, teamId: T.teamA, d4hMemberId: 1, memberName: "Ann" }),
            ],
            ["createRule", (c) => c.createRule({ ...org, teamId: T.teamA, weekday: 1, hour: 9 })],
            ["deleteRule", (c) => c.deleteRule({ ...org, ruleId: T.ruleRunnable })],
            ["getRule", (c) => c.getRule({ ...org, ruleId: T.ruleRunnable })],
            ["getRun", (c) => c.getRun({ ...org, runId: T.runA })],
            ["listEligibleTeams", (c) => c.listEligibleTeams(org)],
            ["listOptOuts", (c) => c.listOptOuts(org)],
            ["listRules", (c) => c.listRules(org)],
            ["listRuns", (c) => c.listRuns(org)],
            ["listTeamD4HMembers", (c) => c.listTeamD4HMembers({ ...org, teamId: T.teamA })],
            ["removeOptOut", (c) => c.removeOptOut({ ...org, optOutId: T.optOutCrossTeam })],
            ["runRule", (c) => c.runRule({ ...org, ruleId: T.ruleRunnable, dryRun: true })],
            ["updateRule", (c) => c.updateRule({ ...org, ruleId: T.ruleRunnable, hour: 8 })],
        ];

        it.each(calls)("refuses %s to a member without d4hNag permissions", async (_, call) => {
            await expect(call(makeCaller(T.member, MEMBER))).rejects.toMatchObject({
                code: "FORBIDDEN",
            });
        });

        it("keeps listTeamD4HMembers on update, refusing view alone", async () => {
            const viewer = makeCaller(T.member, { organization: ["view"], d4hNag: ["view"] });

            await expect(
                viewer.listTeamD4HMembers({ ...org, teamId: T.teamA }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        });

        it("keeps runRule on run, refusing update alone", async () => {
            const editor = makeCaller(T.member, {
                organization: ["view"],
                d4hNag: ["view", "update"],
            });

            await expect(
                editor.runRule({ ...org, ruleId: T.ruleRunnable, dryRun: true }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        });
    });

    describe("getRule", () => {
        const org = { organizationId: T.org };

        it("gives the rule with its team, schedule, latest run and no paused reason", async () => {
            const rule = await makeCaller(T.admin, ADMIN).getRule({
                ...org,
                ruleId: T.ruleRunnable,
            });

            expect(rule).toMatchObject({
                id: T.ruleRunnable,
                team: { id: T.teamA, name: "Alpha" },
                schedule: expect.any(String),
                pausedReason: null,
                lastRun: { id: T.runA, status: "Completed" },
            });
        });

        it("gives a paused rule's reason, and no latest run when it has none", async () => {
            const rule = await makeCaller(T.admin, ADMIN).getRule({
                ...org,
                ruleId: T.rulePaused,
            });

            expect(rule).toMatchObject({ pausedReason: "disabled", lastRun: null });
        });

        it("is allowed on view alone", async () => {
            const viewer = makeCaller(T.member, { organization: ["view"], d4hNag: ["view"] });

            await expect(viewer.getRule({ ...org, ruleId: T.ruleRunnable })).resolves.toMatchObject(
                { id: T.ruleRunnable },
            );
        });
    });

    describe("runRule", () => {
        it("refuses when the module's Vercel flag is off, and starts nothing", async () => {
            vi.mocked(resolveModuleFlags).mockResolvedValue({
                "d4h-nag": false,
            } as Awaited<ReturnType<typeof resolveModuleFlags>>);

            await expect(
                makeCaller(T.admin, ADMIN).runRule({
                    organizationId: T.org,
                    ruleId: T.ruleRunnable,
                    dryRun: false,
                }),
            ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

            expect(await db.d4HNagRun.count({ where: { trigger: "Manual" } })).toBe(0);
            expect(afterCallbacks).toHaveLength(0);
        });

        it("refuses when the module is off in the organization's settings", async () => {
            await expect(
                makeCaller(T.admin, ADMIN).runRule({
                    organizationId: T.otherOrg,
                    ruleId: T.ruleRunnable,
                    dryRun: false,
                }),
            ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });

            expect(afterCallbacks).toHaveLength(0);
        });

        it("refuses when the module is on but the D4H module it requires is off", async () => {
            const d4hModule = { organizationId: T.org, key: "modules.d4h.enabled" };
            await db.organizationConfig.updateMany({ where: d4hModule, data: { value: false } });
            try {
                await expect(
                    makeCaller(T.admin, ADMIN).runRule({
                        organizationId: T.org,
                        ruleId: T.ruleRunnable,
                        dryRun: false,
                    }),
                ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
            } finally {
                await db.organizationConfig.updateMany({ where: d4hModule, data: { value: true } });
            }

            expect(await db.d4HNagRun.count({ where: { trigger: "Manual" } })).toBe(0);
            expect(afterCallbacks).toHaveLength(0);
        });

        it("refuses a paused rule, naming the reason, and starts nothing", async () => {
            await expect(
                makeCaller(T.admin, ADMIN).runRule({
                    organizationId: T.org,
                    ruleId: T.rulePaused,
                    dryRun: false,
                }),
            ).rejects.toMatchObject({
                code: "PRECONDITION_FAILED",
                message: expect.stringContaining("disabled"),
            });

            expect(await db.d4HNagRun.count({ where: { ruleId: T.rulePaused } })).toBe(0);
            expect(afterCallbacks).toHaveLength(0);
        });

        it("returns a Running run's id and schedules executeRun after the response", async () => {
            const { runId } = await makeCaller(T.admin, ADMIN).runRule({
                organizationId: T.org,
                ruleId: T.ruleRunnable,
                dryRun: true,
            });

            const run = await db.d4HNagRun.findUniqueOrThrow({ where: { id: runId } });
            expect(run).toMatchObject({
                status: "Running",
                trigger: "Manual",
                dryRun: true,
                startedById: T.admin,
                teamId: T.teamA,
            });

            expect(afterCallbacks).toHaveLength(1);
            expect(executeRun).not.toHaveBeenCalled();
            await afterCallbacks[0]();
            expect(executeRun).toHaveBeenCalledWith(
                expect.objectContaining({ organizationId: T.org, userId: T.admin }),
                runId,
            );
        });
    });

    describe("listTeamD4HMembers", () => {
        it("lists the team's members by name through the module's token", async () => {
            const result = await makeCaller(T.admin, ADMIN).listTeamD4HMembers({
                organizationId: T.org,
                teamId: T.teamA,
            });

            expect(result).toEqual({
                state: "ok",
                members: [
                    { d4hMemberId: 1, name: "Ann" },
                    { d4hMemberId: 2, name: "Zed" },
                ],
            });
            expect(fetchD4HCurrentTeamMembers).toHaveBeenCalledWith(token, 101);
        });

        it("reports no-token, without calling D4H, when the module has no token", async () => {
            vi.mocked(getD4HNagAccessToken).mockResolvedValue(null);

            const result = await makeCaller(T.admin, ADMIN).listTeamD4HMembers({
                organizationId: T.org,
                teamId: T.teamA,
            });

            expect(result).toEqual({ state: "not-runnable", reason: "no-token" });
            expect(fetchD4HCurrentTeamMembers).not.toHaveBeenCalled();
        });

        it("throws NOT_FOUND for another org's team", async () => {
            await expect(
                makeCaller(T.admin, ADMIN).listTeamD4HMembers({
                    organizationId: T.org,
                    teamId: T.teamOther,
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
        });
    });

    describe("opt-out by token", () => {
        async function firstOptOutEntry(objectId: string) {
            const [entry] = await db.logEntry.findMany({
                where: { objectType: "D4HNagOptOut", objectId },
            });
            return entry;
        }

        it("gives not-found for an unknown token", async () => {
            expect(await anonymous().getOptOutByToken({ token: "no-such-token" })).toEqual({
                state: "not-found",
            });
            expect(
                await anonymous().setOptOutByToken({ token: "no-such-token", optedOut: true }),
            ).toEqual({ state: "not-found" });
        });

        it("opts out and back in, auditing each change in a batch named for the member", async () => {
            const caller = anonymous();

            expect(await caller.getOptOutByToken({ token: TOKEN.mia })).toEqual({
                state: "ok",
                organizationName: `Org ${T.org}`,
                teamName: "Alpha",
                memberName: "Mia",
                optedOut: false,
                teamLinked: true,
            });

            const out = await caller.setOptOutByToken({ token: TOKEN.mia, optedOut: true });
            expect(out).toMatchObject({ state: "ok", optedOut: true });

            const [row] = await db.d4HNagOptOut.findMany({ where: { d4hMemberId: 55 } });
            expect(row).toMatchObject({
                organizationId: T.org,
                teamId: T.teamA,
                memberName: "Mia",
                source: "Self",
                createdById: null,
            });

            const created = await firstOptOutEntry(row.id);
            expect(created).toMatchObject({
                action: "Create",
                organizationId: T.org,
                userId: null,
                actorLabel: "Mia",
            });
            const createBatch = await db.logBatch.findUniqueOrThrow({
                where: { id: created.batchId! },
            });
            expect(createBatch).toMatchObject({
                operationKey: "d4h-nag-opt-out",
                actorLabel: "Mia",
                userId: null,
            });

            // Asking again changes nothing.
            await caller.setOptOutByToken({ token: TOKEN.mia, optedOut: true });
            expect(await db.d4HNagOptOut.count({ where: { d4hMemberId: 55 } })).toBe(1);

            const back = await caller.setOptOutByToken({ token: TOKEN.mia, optedOut: false });
            expect(back).toMatchObject({ state: "ok", optedOut: false });
            expect(await db.d4HNagOptOut.count({ where: { d4hMemberId: 55 } })).toBe(0);

            const deleted = await db.logEntry.findMany({
                where: { objectType: "D4HNagOptOut", objectId: row.id, action: "Delete" },
            });
            expect(deleted).toHaveLength(1);
            expect(deleted[0]).toMatchObject({ userId: null, actorLabel: "Mia" });
            expect(deleted[0].batchId).not.toBe(created.batchId);
        });

        it("counts an opt-out on another team linked to the same D4H team, and opting in removes it", async () => {
            const caller = anonymous();

            expect(await caller.getOptOutByToken({ token: TOKEN.cal })).toMatchObject({
                teamName: "Alpha",
                optedOut: true,
            });

            await caller.setOptOutByToken({ token: TOKEN.cal, optedOut: false });

            expect(
                await db.d4HNagOptOut.findUnique({ where: { id: T.optOutCrossTeam } }),
            ).toBeNull();
            // The other organization's opt-out for the same member is untouched.
            expect(
                await db.d4HNagOptOut.findUnique({ where: { id: T.optOutOtherOrg } }),
            ).not.toBeNull();
            const [entry] = await db.logEntry.findMany({
                where: { objectId: T.optOutCrossTeam, action: "Delete" },
            });
            expect(entry).toMatchObject({ actorLabel: "Cal", userId: null });
            expect(entry.batchId).not.toBeNull();
        });

        it("still works once the run's rule is deleted", async () => {
            await makeCaller(T.admin, ADMIN).deleteRule({
                organizationId: T.org,
                ruleId: T.ruleToDelete,
            });

            const caller = anonymous();
            expect(await caller.getOptOutByToken({ token: TOKEN.noah })).toMatchObject({
                state: "ok",
                teamName: "Bravo",
                optedOut: false,
            });
            await caller.setOptOutByToken({ token: TOKEN.noah, optedOut: true });

            expect(await db.d4HNagOptOut.findMany({ where: { d4hMemberId: 66 } })).toMatchObject([
                { teamId: T.teamB, source: "Self" },
            ]);
        });

        it("opts out on the team now linked when the run's team no longer is", async () => {
            const caller = anonymous();
            expect(await caller.getOptOutByToken({ token: TOKEN.ivy })).toMatchObject({
                state: "ok",
                teamName: "Unlinked",
                optedOut: false,
            });

            const out = await caller.setOptOutByToken({ token: TOKEN.ivy, optedOut: true });
            expect(out).toMatchObject({ state: "ok", optedOut: true });
            expect(await db.d4HNagOptOut.findMany({ where: { d4hMemberId: 88 } })).toMatchObject([
                { teamId: T.teamRelinked, source: "Self" },
            ]);
            expect(await caller.getOptOutByToken({ token: TOKEN.ivy })).toMatchObject({
                optedOut: true,
            });
        });

        it("ignores an opt-out on the run's team once it is unlinked", async () => {
            await db.d4HNagOptOut.create({
                data: {
                    id: D4HNagOptOutId.create(),
                    organizationId: T.org,
                    teamId: T.teamUnlinked,
                    d4hMemberId: 99,
                    memberName: "Owen",
                    source: "Self",
                },
            });

            const caller = anonymous();
            expect(await caller.getOptOutByToken({ token: TOKEN.owen })).toMatchObject({
                state: "ok",
                teamName: "Unlinked",
                optedOut: false,
                teamLinked: false,
            });

            // No team is linked to Owen's D4H team, so nothing can send to him: a no-op.
            const out = await caller.setOptOutByToken({ token: TOKEN.owen, optedOut: true });
            expect(out).toMatchObject({ state: "ok", optedOut: false });
            expect(await db.d4HNagOptOut.count({ where: { d4hMemberId: 99 } })).toBe(1);
        });
    });
});
