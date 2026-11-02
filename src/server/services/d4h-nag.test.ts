/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ConflictError, NotFoundError } from "@/lib/errors";
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
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import * as D4HNag from "./d4h-nag";

// Every D4H call goes through the injected `RunnabilityDeps`; these keep the real token resolver
// and D4H client (and the real Prisma client behind them) out of the test.
vi.mock("@/server/d4h-access-token", () => ({
    getD4HNagAccessToken: vi.fn(),
    toD4HCredentialRef: vi.fn(),
}));

vi.mock("@/server/d4h-api/client", () => ({
    fetchD4HCurrentTeamMembers: vi.fn(),
    getD4HTokenMetadata: vi.fn(),
}));

describe("d4h-nag", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        d4hOffOrg: OrganizationId.create(),
        user: UserId.create(),
        teamA: TeamId.create(),
        teamB: TeamId.create(),
        teamUnlinked: TeamId.create(),
        teamArchived: TeamId.create(),
        teamDeleted: TeamId.create(),
        teamHidden: TeamId.create(),
        teamOther: TeamId.create(),
        teamD4HOff: TeamId.create(),
        ruleRunnable: D4HNagRuleId.create(),
        ruleDisabled: D4HNagRuleId.create(),
        ruleUnlinked: D4HNagRuleId.create(),
        ruleArchived: D4HNagRuleId.create(),
        ruleDeleted: D4HNagRuleId.create(),
        ruleHidden: D4HNagRuleId.create(),
        ruleOther: D4HNagRuleId.create(),
        ruleD4HOff: D4HNagRuleId.create(),
        runOld: D4HNagRunId.create(),
        runNew: D4HNagRunId.create(),
        runOtherRule: D4HNagRunId.create(),
        runOtherOrg: D4HNagRunId.create(),
        recipientLate: D4HNagRecipientId.create(),
        recipientEarlyB: D4HNagRecipientId.create(),
        recipientEarlyA: D4HNagRecipientId.create(),
        optOutOther: D4HNagOptOutId.create(),
    };

    /** Wed 4 Nov 2026, 13:00 NZDT (UTC+13). */
    const NOW = new Date("2026-11-04T00:00:00Z");

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

    /** The token sees D4H teams 101–103, but not 999 (`teamHidden`'s). */
    function makeDeps(overrides: Partial<D4HNag.RunnabilityDeps> = {}) {
        return {
            getToken: vi.fn(async () => token),
            getTokenMetadata: vi.fn(async () => ({
                d4HTeams: [101, 102, 103].map((id) => ({
                    id,
                    title: `D4H ${id}`,
                    resourceType: "Team" as const,
                    permissions: {},
                })),
                d4HOrganisations: [],
            })),
            ...overrides,
        } satisfies D4HNag.RunnabilityDeps;
    }

    beforeAll(async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(NOW);

        for (const id of [T.org, T.otherOrg, T.d4hOffOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }
        for (const organizationId of [T.org, T.otherOrg]) {
            await db.organizationConfig.create({
                data: { organizationId, key: "integrations.d4h.enabled", value: true },
            });
        }
        await db.user.create({
            data: { id: T.user, name: "Ada Admin", email: "ada@example.com" },
        });

        const teams = [
            { id: T.teamA, organizationId: T.org, name: "Alpha", d4hTeamId: 101 },
            { id: T.teamB, organizationId: T.org, name: "Bravo", d4hTeamId: 101 },
            { id: T.teamUnlinked, organizationId: T.org, name: "Unlinked" },
            {
                id: T.teamArchived,
                organizationId: T.org,
                name: "Archived",
                status: "Archived" as const,
                d4hTeamId: 102,
            },
            {
                id: T.teamDeleted,
                organizationId: T.org,
                name: "Deleted",
                status: "Deleted" as const,
                d4hTeamId: 103,
            },
            { id: T.teamHidden, organizationId: T.org, name: "Hidden", d4hTeamId: 999 },
            { id: T.teamOther, organizationId: T.otherOrg, name: "Other", d4hTeamId: 101 },
            { id: T.teamD4HOff, organizationId: T.d4hOffOrg, name: "Off", d4hTeamId: 101 },
        ];
        for (const { d4hTeamId, ...team } of teams) {
            await db.team.create({ data: team });
            if (d4hTeamId !== undefined) {
                await db.team_D4H.create({
                    data: {
                        teamId: team.id,
                        d4hTeamId,
                        d4hTeamName: `D4H ${d4hTeamId}`,
                        d4hServerCode: "ap",
                    },
                });
            }
        }

        const rules = [
            { id: T.ruleRunnable, organizationId: T.org, teamId: T.teamA },
            { id: T.ruleDisabled, organizationId: T.org, teamId: T.teamA, enabled: false },
            { id: T.ruleUnlinked, organizationId: T.org, teamId: T.teamUnlinked },
            { id: T.ruleArchived, organizationId: T.org, teamId: T.teamArchived },
            { id: T.ruleDeleted, organizationId: T.org, teamId: T.teamDeleted },
            { id: T.ruleHidden, organizationId: T.org, teamId: T.teamHidden },
            { id: T.ruleOther, organizationId: T.otherOrg, teamId: T.teamOther },
            { id: T.ruleD4HOff, organizationId: T.d4hOffOrg, teamId: T.teamD4HOff },
        ];
        for (const rule of rules) {
            await db.d4HNagRule.create({ data: { weekday: 1, hour: 19, ...rule } });
        }

        const run = (id: string, organizationId: string, ruleId: string, startedAt: string) => ({
            id,
            organizationId,
            ruleId,
            teamId: organizationId === T.org ? T.teamA : T.teamOther,
            teamName: "Alpha",
            trigger: "Cron" as const,
            dryRun: false,
            status: "Completed" as const,
            startedAt: new Date(startedAt),
            windowStart: new Date(startedAt),
            windowEnd: new Date(startedAt),
        });
        await db.d4HNagRun.create({
            data: run(T.runOld, T.org, T.ruleRunnable, "2026-10-26T06:00:00Z"),
        });
        await db.d4HNagRun.create({
            data: run(T.runNew, T.org, T.ruleRunnable, "2026-11-02T06:00:00Z"),
        });
        await db.d4HNagRun.create({
            data: run(T.runOtherRule, T.org, T.ruleDisabled, "2026-11-01T06:00:00Z"),
        });
        await db.d4HNagRun.create({
            data: run(T.runOtherOrg, T.otherOrg, T.ruleOther, "2026-11-02T06:00:00Z"),
        });

        const recipient = (id: string, startsAt: string, memberName: string) => ({
            id,
            organizationId: T.org,
            runId: T.runNew,
            d4hTeamId: 101,
            d4hExerciseId: 1,
            exerciseTitle: "Training",
            exerciseStartsAt: new Date(startsAt),
            d4hMemberId: 1,
            memberName,
            email: "m@example.com",
            outcome: "Sent" as const,
            tokenHash: `hash-${id}`,
            dedupeKey: `key-${id}`,
        });
        await db.d4HNagRecipient.create({
            data: recipient(T.recipientLate, "2026-11-03T06:00:00Z", "Aaron"),
        });
        await db.d4HNagRecipient.create({
            data: recipient(T.recipientEarlyB, "2026-11-02T06:00:00Z", "Bea"),
        });
        await db.d4HNagRecipient.create({
            data: recipient(T.recipientEarlyA, "2026-11-02T06:00:00Z", "Abe"),
        });

        await db.d4HNagOptOut.create({
            data: {
                id: T.optOutOther,
                organizationId: T.otherOrg,
                teamId: T.teamOther,
                d4hMemberId: 7,
                memberName: "Olive",
                source: "Self",
            },
        });
    });

    afterAll(() => {
        vi.useRealTimers();
    });

    function makeCtx(organizationId: OrganizationId = T.org) {
        return createOrganizationMockContext({
            organizationId,
            user: { id: T.user },
            prisma: db,
        });
    }

    async function logEntriesFor(objectId: string) {
        return db.logEntry.findMany({ where: { objectId } });
    }

    describe("listRules", () => {
        it("gives the first paused reason for each rule, or null when runnable", async () => {
            const rules = await D4HNag.listRules(makeCtx(), makeDeps());
            const reasonOf = (id: string) => rules.find((rule) => rule.id === id)?.pausedReason;

            expect(reasonOf(T.ruleRunnable)).toBeNull();
            expect(reasonOf(T.ruleDisabled)).toBe("disabled");
            expect(reasonOf(T.ruleArchived)).toBe("team-inactive");
            expect(reasonOf(T.ruleDeleted)).toBe("team-inactive");
            expect(reasonOf(T.ruleUnlinked)).toBe("team-unlinked");
            expect(reasonOf(T.ruleHidden)).toBe("token-cannot-see-team");
        });

        it("reports no-token for linked active rules when the module has no token", async () => {
            const rules = await D4HNag.listRules(
                makeCtx(),
                makeDeps({ getToken: vi.fn(async () => null) }),
            );
            const reasonOf = (id: string) => rules.find((rule) => rule.id === id)?.pausedReason;

            expect(reasonOf(T.ruleRunnable)).toBe("no-token");
            expect(reasonOf(T.ruleHidden)).toBe("no-token");
            // Earlier checks still win.
            expect(reasonOf(T.ruleUnlinked)).toBe("team-unlinked");
        });

        it("reports d4h-disabled ahead of everything when the D4H integration is off", async () => {
            const deps = makeDeps();
            const rules = await D4HNag.listRules(makeCtx(T.d4hOffOrg), deps);

            expect(rules.map((rule) => [rule.id, rule.pausedReason])).toEqual([
                [T.ruleD4HOff, "d4h-disabled"],
            ]);
            expect(deps.getToken).not.toHaveBeenCalled();
        });

        it("reports d4h-unavailable, not an error, when the token metadata lookup fails", async () => {
            const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
            const deps = makeDeps({
                getTokenMetadata: vi.fn(async () => {
                    throw new Error("D4H is down");
                }),
            });
            const rules = await D4HNag.listRules(makeCtx(), deps);
            const reasonOf = (id: string) => rules.find((rule) => rule.id === id)?.pausedReason;

            expect(reasonOf(T.ruleRunnable)).toBe("d4h-unavailable");
            expect(reasonOf(T.ruleHidden)).toBe("d4h-unavailable");
            // Checks before the D4H lookup still win.
            expect(reasonOf(T.ruleUnlinked)).toBe("team-unlinked");
            expect(deps.getTokenMetadata).toHaveBeenCalledTimes(1);
            expect(consoleError).toHaveBeenCalledTimes(1);
            consoleError.mockRestore();
        });

        it("reads the token and its metadata once for all the org's rules", async () => {
            const deps = makeDeps();
            await D4HNag.listRules(makeCtx(), deps);

            expect(deps.getToken).toHaveBeenCalledTimes(1);
            expect(deps.getTokenMetadata).toHaveBeenCalledTimes(1);
        });

        it("includes the team, the schedule in words and the latest run", async () => {
            const rules = await D4HNag.listRules(makeCtx(), makeDeps());
            const rule = rules.find((r) => r.id === T.ruleRunnable);

            expect(rule?.team).toEqual({ id: T.teamA, name: "Alpha" });
            expect(rule?.schedule).toBe("Mondays at 19:00");
            expect(rule?.lastRun?.id).toBe(T.runNew);
            expect(rules.find((r) => r.id === T.ruleUnlinked)?.lastRun).toBeNull();
        });

        it("lists only the organization's own rules", async () => {
            const rules = await D4HNag.listRules(makeCtx(), makeDeps());

            expect(rules.map((rule) => rule.id)).not.toContain(T.ruleOther);
        });
    });

    describe("checkRunnable", () => {
        it("throws when the token metadata lookup fails", async () => {
            const deps = makeDeps({
                getTokenMetadata: vi.fn(async () => {
                    throw new Error("D4H is down");
                }),
            });
            await expect(D4HNag.checkRunnable(makeCtx(), T.ruleRunnable, deps)).rejects.toThrow(
                "D4H is down",
            );
        });

        it("returns the token, D4H team and timezone for a runnable rule", async () => {
            const result = await D4HNag.checkRunnable(makeCtx(), T.ruleRunnable, makeDeps());

            expect(result).toEqual({
                runnable: true,
                token,
                d4hTeamId: 101,
                timeZone: "Pacific/Auckland",
            });
        });

        it("throws NotFoundError for another organization's rule", async () => {
            await expect(D4HNag.checkRunnable(makeCtx(), T.ruleOther, makeDeps())).rejects.toThrow(
                NotFoundError,
            );
        });
    });

    describe("requireRuleById", () => {
        it("throws NotFoundError for a rule in another organization", async () => {
            await expect(D4HNag.requireRuleById(makeCtx(), T.ruleOther)).rejects.toThrow(
                NotFoundError,
            );
        });
    });

    describe("createRule", () => {
        const input = {
            teamId: T.teamB,
            weekday: 1,
            hour: 19,
            lookAheadHours: 24,
            message: "Bring boots",
            enabled: true,
        };

        it("creates the rule with its latest slot already claimed, and logs it", async () => {
            const created = await D4HNag.createRule(makeCtx(), input);

            expect(created).toMatchObject({ ...input, teamId: T.teamB });
            // Mon 2 Nov 19:00 NZDT: already past, so it must never fire.
            expect(created.lastScheduledFor).toBe("2026-11-02T06:00:00.000Z");

            const record = await db.d4HNagRule.findUnique({ where: { id: created.id } });
            expect(record?.organizationId).toBe(T.org);
            expect(record?.createdById).toBe(T.user);

            const [entry] = await logEntriesFor(created.id);
            expect(entry).toMatchObject({
                action: "Create",
                objectType: "D4HNagRule",
                description: "Bravo: Mondays at 19:00",
            });
            expect(JSON.stringify(entry.changes)).toContain("Bring boots");
            // Filed on the team's history too.
            const teamRef = await db.logEntryObject.findFirst({
                where: { logEntryId: entry.id, objectType: "Team" },
            });
            expect(teamRef).toMatchObject({ objectId: T.teamB, role: "context" });
        });

        it("rejects a team in another organization", async () => {
            await expect(
                D4HNag.createRule(makeCtx(), { ...input, teamId: T.teamOther }),
            ).rejects.toThrow(NotFoundError);
        });

        it.each([
            ["archived", T.teamArchived],
            ["deleted", T.teamDeleted],
            ["unlinked", T.teamUnlinked],
        ])("rejects an %s team", async (_label, teamId) => {
            await expect(D4HNag.createRule(makeCtx(), { ...input, teamId })).rejects.toThrow(
                NotFoundError,
            );
        });
    });

    describe("updateRule", () => {
        const OLD_CLAIM = new Date("2026-10-01T00:00:00Z");

        async function seedRule(data: { enabled?: boolean } = {}) {
            const id = D4HNagRuleId.create();
            await db.d4HNagRule.create({
                data: {
                    id,
                    organizationId: T.org,
                    teamId: T.teamB,
                    weekday: 1,
                    hour: 19,
                    lastScheduledFor: OLD_CLAIM,
                    ...data,
                },
            });
            return id;
        }

        it("leaves lastScheduledFor alone when only the message or window changes", async () => {
            const id = await seedRule();
            const updated = await D4HNag.updateRule(makeCtx(), id, {
                message: "New text",
                lookAheadHours: 48,
            });

            expect(updated).toMatchObject({ message: "New text", lookAheadHours: 48 });
            expect(updated.lastScheduledFor).toBe(OLD_CLAIM.toISOString());

            const [entry] = await logEntriesFor(id);
            expect(entry).toMatchObject({ action: "Update", objectType: "D4HNagRule" });
            expect(JSON.stringify(entry.changes)).toContain("New text");
        });

        it("moves lastScheduledFor to the new latest slot when the schedule changes", async () => {
            const id = await seedRule();
            // Wednesdays at 09:00: today's 09:00 NZDT has passed (now is 13:00).
            const updated = await D4HNag.updateRule(makeCtx(), id, { weekday: 3, hour: 9 });

            expect(updated.lastScheduledFor).toBe("2026-11-03T20:00:00.000Z");
        });

        it("moves lastScheduledFor to the latest slot when the rule is enabled", async () => {
            const id = await seedRule({ enabled: false });
            const updated = await D4HNag.updateRule(makeCtx(), id, { enabled: true });

            expect(updated.enabled).toBe(true);
            expect(updated.lastScheduledFor).toBe("2026-11-02T06:00:00.000Z");
        });

        it("is a no-op, with no log entry, when nothing changes", async () => {
            const id = await seedRule();
            const updated = await D4HNag.updateRule(makeCtx(), id, { weekday: 1, hour: 19 });

            expect(updated.lastScheduledFor).toBe(OLD_CLAIM.toISOString());
            expect(await logEntriesFor(id)).toHaveLength(0);
        });

        it("throws NotFoundError for a rule in another organization", async () => {
            await expect(D4HNag.updateRule(makeCtx(), T.ruleOther, { hour: 8 })).rejects.toThrow(
                NotFoundError,
            );
        });
    });

    describe("deleteRule", () => {
        it("deletes the rule, keeps its runs with ruleId null, and logs it", async () => {
            const ruleId = D4HNagRuleId.create();
            const runId = D4HNagRunId.create();
            await db.d4HNagRule.create({
                data: { id: ruleId, organizationId: T.org, teamId: T.teamB, weekday: 2, hour: 7 },
            });
            await db.d4HNagRun.create({
                data: {
                    id: runId,
                    organizationId: T.org,
                    ruleId,
                    teamId: T.teamB,
                    teamName: "Bravo",
                    trigger: "Manual",
                    dryRun: true,
                    status: "Completed",
                    windowStart: NOW,
                    windowEnd: NOW,
                },
            });

            await D4HNag.deleteRule(makeCtx(), ruleId);

            expect(await db.d4HNagRule.findUnique({ where: { id: ruleId } })).toBeNull();
            const run = await db.d4HNagRun.findUnique({ where: { id: runId } });
            expect(run).not.toBeNull();
            expect(run?.ruleId).toBeNull();

            const [entry] = await logEntriesFor(ruleId);
            expect(entry).toMatchObject({
                action: "Delete",
                objectType: "D4HNagRule",
                description: "Bravo: Tuesdays at 07:00",
            });
        });

        it("throws NotFoundError for a rule in another organization", async () => {
            await expect(D4HNag.deleteRule(makeCtx(), T.ruleOther)).rejects.toThrow(NotFoundError);
        });
    });

    describe("listEligibleTeams", () => {
        it("lists the organization's active teams linked to D4H, by name", async () => {
            const teams = await D4HNag.listEligibleTeams(makeCtx());

            expect(teams).toEqual([
                { id: T.teamA, name: "Alpha", d4hTeamId: 101, d4hTeamName: "D4H 101" },
                { id: T.teamB, name: "Bravo", d4hTeamId: 101, d4hTeamName: "D4H 101" },
                { id: T.teamHidden, name: "Hidden", d4hTeamId: 999, d4hTeamName: "D4H 999" },
            ]);
        });
    });

    describe("opt-outs", () => {
        it("adds an admin opt-out, lists it and logs it", async () => {
            const added = await D4HNag.addOptOut(makeCtx(), {
                teamId: T.teamA,
                d4hMemberId: 42,
                memberName: "Mia Member",
            });

            expect(added).toMatchObject({
                team: { id: T.teamA, name: "Alpha" },
                d4hMemberId: 42,
                memberName: "Mia Member",
                source: "Admin",
                createdBy: { id: T.user, name: "Ada Admin" },
            });

            const listed = await D4HNag.listOptOuts(makeCtx());
            expect(listed.map((optOut) => optOut.id)).toEqual([added.id]);

            const [entry] = await logEntriesFor(added.id);
            expect(entry).toMatchObject({
                action: "Create",
                objectType: "D4HNagOptOut",
                description: "Mia Member",
            });
        });

        it("maps an existing opt-out for the same team and member to ConflictError", async () => {
            const input = { teamId: T.teamB, d4hMemberId: 43, memberName: "Max Member" };
            await D4HNag.addOptOut(makeCtx(), input);

            await expect(D4HNag.addOptOut(makeCtx(), input)).rejects.toThrow(ConflictError);
        });

        it("rejects a team in another organization", async () => {
            await expect(
                D4HNag.addOptOut(makeCtx(), {
                    teamId: T.teamOther,
                    d4hMemberId: 44,
                    memberName: "Nope",
                }),
            ).rejects.toThrow(NotFoundError);
        });

        it("removes an opt-out and logs it", async () => {
            const added = await D4HNag.addOptOut(makeCtx(), {
                teamId: T.teamA,
                d4hMemberId: 45,
                memberName: "Remy",
            });

            await D4HNag.removeOptOut(makeCtx(), added.id);

            expect(await db.d4HNagOptOut.findUnique({ where: { id: added.id } })).toBeNull();
            const entries = await logEntriesFor(added.id);
            expect(entries.map((entry) => entry.action).sort()).toEqual(["Create", "Delete"]);
        });

        it("won't remove another organization's opt-out", async () => {
            await expect(D4HNag.removeOptOut(makeCtx(), T.optOutOther)).rejects.toThrow(
                NotFoundError,
            );
        });
    });

    describe("runs", () => {
        it("lists the organization's runs newest first, filtered by rule when asked", async () => {
            const all = await D4HNag.listRuns(makeCtx());
            expect(all.map((run) => run.id)).toEqual(
                expect.arrayContaining([T.runNew, T.runOtherRule, T.runOld]),
            );
            expect(all.map((run) => run.id)).not.toContain(T.runOtherOrg);

            const forRule = await D4HNag.listRuns(makeCtx(), { ruleId: T.ruleRunnable });
            expect(forRule.map((run) => run.id)).toEqual([T.runNew, T.runOld]);
        });

        it("returns a run with its recipients, by exercise start then name, without secrets", async () => {
            const run = await D4HNag.requireRunById(makeCtx(), T.runNew);

            expect(run.recipients.map((recipient) => recipient.id)).toEqual([
                T.recipientEarlyA,
                T.recipientEarlyB,
                T.recipientLate,
            ]);
            expect(run.recipients[0]).not.toHaveProperty("tokenHash");
            expect(run.recipients[0]).not.toHaveProperty("dedupeKey");
            expect(run.startedBy).toBeNull();
        });

        it("throws NotFoundError for a run in another organization", async () => {
            await expect(D4HNag.requireRunById(makeCtx(), T.runOtherOrg)).rejects.toThrow(
                NotFoundError,
            );
        });
    });
});
