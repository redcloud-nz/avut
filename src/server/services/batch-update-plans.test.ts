/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { ConflictError, NotFoundError } from "@/lib/errors";
import { BatchUpdatePlanId, type BatchUpdatePlanStatus } from "@/lib/schemas/batch-update-plan";
import { OrganizationId } from "@/lib/schemas/organization";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import * as BatchUpdatePlans from "./batch-update-plans";
import { EXECUTION_STALE_MS, PLAN_TTL_MS, type PlanTarget } from "./batch-update-plans";

const NOW = new Date("2026-10-19T12:00:00Z");
const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60 * 1000);

describe("batch-update-plans", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: UserId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }
        await db.user.create({
            data: { id: T.user, name: "Pat Planner", email: "pat@example.com" },
        });
    });

    function makeCtx(organizationId: OrganizationId = T.org) {
        return createOrganizationMockContext({ organizationId, user: { id: T.user }, prisma: db });
    }

    /** A fresh lock key per test, so tests sharing the dataset never contend with each other. */
    function newTarget(kind = "d4h-team-sync"): PlanTarget {
        return { kind, targetType: "Team", targetId: TeamId.create() };
    }

    async function seedPlan(
        target: PlanTarget,
        {
            status = "Pending",
            createdAt = minutesAgo(1),
            executionStartedAt = null,
            organizationId = T.org,
        }: {
            status?: BatchUpdatePlanStatus;
            createdAt?: Date;
            executionStartedAt?: Date | null;
            organizationId?: OrganizationId;
        } = {},
    ): Promise<BatchUpdatePlanId> {
        const id = BatchUpdatePlanId.create();
        await db.batchUpdatePlan.create({
            data: {
                id,
                organizationId,
                ...target,
                status,
                payload: { items: [] },
                createdAt,
                executionStartedAt,
            },
        });
        return id;
    }

    async function statusOf(id: string) {
        return (await db.batchUpdatePlan.findUniqueOrThrow({ where: { id } })).status;
    }

    describe("create and requireById", () => {
        it("persists a pending plan created by the calling user", async () => {
            const target = newTarget();
            const plan = await BatchUpdatePlans.create(makeCtx(), {
                ...target,
                payload: { items: [1, 2] },
            });

            expect(plan).toMatchObject({
                ...target,
                organizationId: T.org,
                status: "Pending",
                createdById: T.user,
                payload: { items: [1, 2] },
            });
            const found = await BatchUpdatePlans.requireById(
                makeCtx(),
                BatchUpdatePlanId.schema.parse(plan.id),
            );
            expect(found.id).toBe(plan.id);
        });

        it("doesn't find another organization's plan", async () => {
            const id = await seedPlan(newTarget(), { organizationId: T.otherOrg });

            await expect(BatchUpdatePlans.requireById(makeCtx(), id)).rejects.toThrow(
                NotFoundError,
            );
        });
    });

    describe("claim", () => {
        it("claims a pending plan", async () => {
            const id = await seedPlan(newTarget());

            const plan = await BatchUpdatePlans.claim(makeCtx(), id, NOW);

            expect(plan.status).toBe("Executing");
            expect(plan.executionStartedAt).toEqual(NOW);
        });

        it("refuses an expired plan", async () => {
            const id = await seedPlan(newTarget(), {
                createdAt: new Date(NOW.getTime() - PLAN_TTL_MS - 1000),
            });

            await expect(BatchUpdatePlans.claim(makeCtx(), id, NOW)).rejects.toThrow(
                new ConflictError("This preview has expired. Refresh it and try again."),
            );
            expect(await statusOf(id)).toBe("Pending");
        });

        it("refuses a completed plan", async () => {
            const id = await seedPlan(newTarget(), { status: "Completed" });

            await expect(BatchUpdatePlans.claim(makeCtx(), id, NOW)).rejects.toThrow(
                new ConflictError("This plan has already been run."),
            );
        });

        it("refuses a superseded plan", async () => {
            const id = await seedPlan(newTarget(), { status: "Superseded" });

            await expect(BatchUpdatePlans.claim(makeCtx(), id, NOW)).rejects.toThrow(
                new ConflictError(
                    "This preview has been replaced by a newer one. Refresh it and try again.",
                ),
            );
        });

        it("says 'already running' before the plan's own status", async () => {
            const target = newTarget();
            await seedPlan(target, { status: "Executing", executionStartedAt: minutesAgo(1) });
            const id = await seedPlan(target, { status: "Superseded" });

            await expect(BatchUpdatePlans.claim(makeCtx(), id, NOW)).rejects.toThrow(
                new ConflictError("A sync of this team is already running"),
            );
        });

        it("refuses a second claim of the same plan as already running", async () => {
            const id = await seedPlan(newTarget());
            await BatchUpdatePlans.claim(makeCtx(), id, NOW);

            await expect(BatchUpdatePlans.claim(makeCtx(), id, NOW)).rejects.toThrow(
                new ConflictError("A sync of this team is already running"),
            );
        });

        it("refuses another organization's plan as not found", async () => {
            const id = await seedPlan(newTarget(), { organizationId: T.otherOrg });

            await expect(BatchUpdatePlans.claim(makeCtx(), id, NOW)).rejects.toThrow(NotFoundError);
            expect(await statusOf(id)).toBe("Pending");
        });

        it("supersedes the target's other pending plans once the check passes", async () => {
            const target = newTarget();
            const id = await seedPlan(target);
            const sibling = await seedPlan(target);
            const otherTarget = await seedPlan(newTarget());
            const otherOrg = await seedPlan(target, { organizationId: T.otherOrg });

            await BatchUpdatePlans.claim(makeCtx(), id, NOW);

            expect(await statusOf(sibling)).toBe("Superseded");
            expect(await statusOf(otherTarget)).toBe("Pending");
            expect(await statusOf(otherOrg)).toBe("Pending");
        });

        it("supersedes nothing when the contention check fails", async () => {
            const target = newTarget();
            await seedPlan(target, { status: "Executing", executionStartedAt: minutesAgo(1) });
            const id = await seedPlan(target);
            const sibling = await seedPlan(target);

            // `claimRow` succeeds (the running plan doesn't stop it); `checkContention` backs off.
            await expect(BatchUpdatePlans.claim(makeCtx(), id, NOW)).rejects.toThrow(
                new ConflictError("A sync of this team is already running"),
            );
            expect(await statusOf(id)).toBe("Superseded");
            expect(await statusOf(sibling)).toBe("Pending");
        });

        it("never lets two interleaved claims both succeed; the loser ends superseded", async () => {
            const target = newTarget();
            const a = await seedPlan(target);
            const b = await seedPlan(target);
            const ctx = makeCtx();

            const rowA = await BatchUpdatePlans.claimRow(ctx, a, NOW);
            const rowB = await BatchUpdatePlans.claimRow(ctx, b, NOW);

            // A checks first and sees B executing, so A backs off; B then sees no rival.
            await expect(BatchUpdatePlans.checkContention(ctx, rowA, NOW)).rejects.toThrow(
                new ConflictError("A sync of this team is already running"),
            );
            await expect(BatchUpdatePlans.checkContention(ctx, rowB, NOW)).resolves.toBeUndefined();

            expect(await statusOf(a)).toBe("Superseded");
            expect(await statusOf(b)).toBe("Executing");
        });

        it("ignores a stale executing plan", async () => {
            const target = newTarget();
            const stale = await seedPlan(target, {
                status: "Executing",
                executionStartedAt: new Date(NOW.getTime() - EXECUTION_STALE_MS - 1000),
            });
            const id = await seedPlan(target);

            expect(await BatchUpdatePlans.findExecuting(makeCtx(), target, NOW)).toBeNull();
            const plan = await BatchUpdatePlans.claim(makeCtx(), id, NOW);
            expect(plan.status).toBe("Executing");
            expect(await statusOf(stale)).toBe("Executing");
        });

        it("isn't blocked by, and doesn't supersede, a plan of another kind on the same target", async () => {
            const target = newTarget();
            const otherKind = { ...target, kind: "personnel-import" };
            await seedPlan(otherKind, { status: "Executing", executionStartedAt: minutesAgo(1) });
            const otherKindPending = await seedPlan(otherKind);
            const id = await seedPlan(target);

            const plan = await BatchUpdatePlans.claim(makeCtx(), id, NOW);

            expect(plan.status).toBe("Executing");
            expect(await statusOf(otherKindPending)).toBe("Pending");
        });
    });

    describe("findExecuting", () => {
        it("returns the target's running plan, scoped to the organization and kind", async () => {
            const target = newTarget();
            const id = await seedPlan(target, {
                status: "Executing",
                executionStartedAt: minutesAgo(1),
            });

            expect((await BatchUpdatePlans.findExecuting(makeCtx(), target, NOW))?.id).toBe(id);
            expect(
                await BatchUpdatePlans.findExecuting(makeCtx(T.otherOrg), target, NOW),
            ).toBeNull();
            expect(
                await BatchUpdatePlans.findExecuting(
                    makeCtx(),
                    { ...target, kind: "personnel-import" },
                    NOW,
                ),
            ).toBeNull();
        });
    });

    describe("supersedePending", () => {
        it("supersedes only the lock key's pending plans", async () => {
            const target = newTarget();
            const pending = await seedPlan(target);
            const running = await seedPlan(target, {
                status: "Executing",
                executionStartedAt: minutesAgo(1),
            });
            const otherKind = await seedPlan({ ...target, kind: "personnel-import" });

            const { count } = await BatchUpdatePlans.supersedePending(makeCtx(), target);

            expect(count).toBe(1);
            expect(await statusOf(pending)).toBe("Superseded");
            expect(await statusOf(running)).toBe("Executing");
            expect(await statusOf(otherKind)).toBe("Pending");
        });
    });

    describe("finish", () => {
        it("records the outcome of an executing plan", async () => {
            const id = await seedPlan(newTarget(), {
                status: "Executing",
                executionStartedAt: minutesAgo(1),
            });

            const updated = await BatchUpdatePlans.finish(makeCtx(), id, {
                status: "Completed",
                outcomes: [{ itemId: "add:1", result: "applied" }],
                logBatchId: "batch-1",
            });

            expect(updated).toBe(true);
            const plan = await db.batchUpdatePlan.findUniqueOrThrow({ where: { id } });
            expect(plan).toMatchObject({
                status: "Completed",
                outcomes: [{ itemId: "add:1", result: "applied" }],
                logBatchId: "batch-1",
            });
            expect(plan.completedAt).not.toBeNull();
        });

        it("is a no-op once cleanup has marked the plan failed", async () => {
            const id = await seedPlan(newTarget(), { status: "Failed" });

            const updated = await BatchUpdatePlans.finish(makeCtx(), id, {
                status: "Completed",
                outcomes: [],
            });

            expect(updated).toBe(false);
            expect(await statusOf(id)).toBe("Failed");
        });

        it("doesn't touch another organization's plan", async () => {
            const id = await seedPlan(newTarget(), {
                status: "Executing",
                executionStartedAt: minutesAgo(1),
                organizationId: T.otherOrg,
            });

            expect(
                await BatchUpdatePlans.finish(makeCtx(), id, { status: "Completed", outcomes: [] }),
            ).toBe(false);
            expect(await statusOf(id)).toBe("Executing");
        });
    });

    describe("runCleanup", () => {
        it("fails stale executions and deletes old rows, leaving fresh and executing ones", async () => {
            const cleanupDb = createMockPrisma();
            await cleanupDb.organization.create({
                data: { id: T.org, name: "Org", slug: "org", createdAt: new Date() },
            });
            const old = new Date(NOW.getTime() - PLAN_TTL_MS - 1000);
            const target = newTarget();
            const rows: Record<
                string,
                { status: BatchUpdatePlanStatus; createdAt: Date; executionStartedAt?: Date }
            > = {
                oldPending: { status: "Pending", createdAt: old },
                oldCompleted: { status: "Completed", createdAt: old },
                oldSuperseded: { status: "Superseded", createdAt: old },
                freshPending: { status: "Pending", createdAt: minutesAgo(5) },
                freshCompleted: { status: "Completed", createdAt: minutesAgo(5) },
                running: { status: "Executing", createdAt: old, executionStartedAt: minutesAgo(1) },
                staleFresh: {
                    status: "Executing",
                    createdAt: minutesAgo(30),
                    executionStartedAt: minutesAgo(20),
                },
            };
            const ids = new Map<string, string>();
            for (const [label, row] of Object.entries(rows)) {
                const id = BatchUpdatePlanId.create();
                ids.set(id, label);
                await cleanupDb.batchUpdatePlan.create({
                    data: { id, organizationId: T.org, ...target, payload: {}, ...row },
                });
            }

            const result = await BatchUpdatePlans.runCleanup(cleanupDb, NOW);

            expect(result).toEqual({ failed: 1, deleted: 3 });
            const remaining = await cleanupDb.batchUpdatePlan.findMany();
            expect(
                Object.fromEntries(remaining.map((row) => [ids.get(row.id), row.status])),
            ).toEqual({
                freshCompleted: "Completed",
                freshPending: "Pending",
                running: "Executing",
                staleFresh: "Failed",
            });
        });
    });
});
