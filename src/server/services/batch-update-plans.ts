/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/*
 * The lifecycle of a persisted bulk-operation plan (`BatchUpdatePlan`): create, claim, finish,
 * supersede, clean up. It knows nothing about any one kind of operation. The payload and outcomes
 * are opaque here; each kind parses them with its own Zod schema.
 *
 * Every lifecycle rule applies among plans with the same lock key, `(kind, targetType, targetId)`
 * (`PlanTarget`): one execution at a time, superseding, and `findExecuting`. A plan of one kind
 * never blocks or supersedes a plan of another kind on the same target.
 *
 * Plan rows are bookkeeping and aren't audited themselves; executing a plan logs its own entries.
 */

import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { BatchUpdatePlanId, type BatchUpdatePlanRecord } from "@/lib/schemas/batch-update-plan";

import type { OrgServiceContext } from "./service-context";

/** A `Pending` plan older than this can't be claimed, and cleanup deletes it. */
export const PLAN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * An `Executing` plan whose `executionStartedAt` is older than this counts as dead: it no longer
 * blocks a claim, and cleanup marks it `Failed`. Must exceed the function timeout (300s default).
 */
export const EXECUTION_STALE_MS = 10 * 60 * 1000;

const ALREADY_RUNNING = "A sync of this team is already running";

/** A plan's lock key. Every lifecycle query filters on all three fields. */
export interface PlanTarget {
    kind: string;
    targetType: string;
    targetId: string;
}

type PlanContext = Pick<OrgServiceContext, "prisma" | "organizationId" | "userId">;

function targetWhere(ctx: Pick<OrgServiceContext, "organizationId">, target: PlanTarget) {
    return {
        organizationId: ctx.organizationId,
        kind: target.kind,
        targetType: target.targetType,
        targetId: target.targetId,
    };
}

const ago = (now: Date, ms: number) => new Date(now.getTime() - ms);

/** Persist a new `Pending` plan, created by the calling user. */
export async function create(
    ctx: PlanContext,
    input: PlanTarget & { payload: unknown },
): Promise<BatchUpdatePlanRecord> {
    return ctx.prisma.batchUpdatePlan.create({
        data: {
            id: BatchUpdatePlanId.create(),
            organizationId: ctx.organizationId,
            kind: input.kind,
            targetType: input.targetType,
            targetId: input.targetId,
            status: "Pending",
            // The caller's schema has already shaped the payload as JSON.
            payload: input.payload as Prisma.InputJsonValue,
            createdById: ctx.userId,
        },
    });
}

/**
 * Fetch a plan by id within the organization.
 * @throws NotFoundError if the plan does not exist within the organization.
 */
export async function requireById(
    ctx: Pick<OrgServiceContext, "prisma" | "organizationId">,
    planId: BatchUpdatePlanId,
): Promise<BatchUpdatePlanRecord> {
    const plan = await ctx.prisma.batchUpdatePlan.findFirst({
        where: { id: planId, organizationId: ctx.organizationId },
    });
    if (!plan) throw new NotFoundError(`Plan ${planId} not found`);
    return plan;
}

/** The target's non-stale `Executing` plan, or `null` if none is running. */
export async function findExecuting(
    ctx: Pick<OrgServiceContext, "prisma" | "organizationId">,
    target: PlanTarget,
    now: Date,
): Promise<BatchUpdatePlanRecord | null> {
    return ctx.prisma.batchUpdatePlan.findFirst({
        where: {
            ...targetWhere(ctx, target),
            status: "Executing",
            executionStartedAt: { gt: ago(now, EXECUTION_STALE_MS) },
        },
    });
}

/**
 * Step 1 of `claim`: move this plan from `Pending` to `Executing`, if it's still claimable.
 * Returns the claimed row.
 * @throws NotFoundError if the plan does not exist within the organization.
 * @throws ConflictError if the plan isn't claimable: a plan for the same target is already
 *   running, or this one has already run, been superseded, or expired.
 */
export async function claimRow(
    ctx: Pick<OrgServiceContext, "prisma" | "organizationId">,
    planId: BatchUpdatePlanId,
    now: Date,
): Promise<BatchUpdatePlanRecord> {
    const { count } = await ctx.prisma.batchUpdatePlan.updateMany({
        where: {
            id: planId,
            organizationId: ctx.organizationId,
            status: "Pending",
            createdAt: { gt: ago(now, PLAN_TTL_MS) },
        },
        data: { status: "Executing", executionStartedAt: now },
    });

    const plan = await requireById(ctx, planId);
    if (count > 0) return plan;

    // "Already running" comes first, so a retry of a plan that backed off reads correctly.
    if (await findExecuting(ctx, plan, now)) throw new ConflictError(ALREADY_RUNNING);

    switch (plan.status) {
        case "Pending":
            throw new ConflictError("This preview has expired. Refresh it and try again.");
        case "Superseded":
            throw new ConflictError(
                "This preview has been replaced by a newer one. Refresh it and try again.",
            );
        default:
            throw new ConflictError("This plan has already been run.");
    }
}

/**
 * Step 2 of `claim`, run after `claimRow` has committed: if any other plan with the same lock key
 * is executing (and not stale), back off by setting this plan to `Superseded`.
 * @throws ConflictError if another plan for the same target is already running.
 */
export async function checkContention(
    ctx: Pick<OrgServiceContext, "prisma" | "organizationId">,
    plan: Pick<BatchUpdatePlanRecord, "id"> & PlanTarget,
    now: Date,
): Promise<void> {
    const other = await ctx.prisma.batchUpdatePlan.findFirst({
        where: {
            ...targetWhere(ctx, plan),
            id: { not: plan.id },
            status: "Executing",
            executionStartedAt: { gt: ago(now, EXECUTION_STALE_MS) },
        },
        select: { id: true },
    });
    if (!other) return;

    await ctx.prisma.batchUpdatePlan.updateMany({
        where: { id: plan.id, organizationId: ctx.organizationId, status: "Executing" },
        data: { status: "Superseded" },
    });
    throw new ConflictError(ALREADY_RUNNING);
}

/**
 * Claim a plan for execution, in three separately committed statements: claim this row
 * (`claimRow`), check no other plan for the target is running (`checkContention`), then
 * supersede the target's other `Pending` plans. Of two simultaneous claims, at least the later
 * one sees the other; at worst both back off. Returns the claimed (`Executing`) row.
 * @throws NotFoundError if the plan does not exist within the organization.
 * @throws ConflictError if the plan can't be claimed.
 */
export async function claim(
    ctx: Pick<OrgServiceContext, "prisma" | "organizationId">,
    planId: BatchUpdatePlanId,
    now: Date,
): Promise<BatchUpdatePlanRecord> {
    const plan = await claimRow(ctx, planId, now);
    await checkContention(ctx, plan, now);
    // This plan is `Executing` now, so only the others are still `Pending`.
    await supersedePending(ctx, plan);
    return plan;
}

/**
 * Supersede every `Pending` plan with this lock key. Returns the unawaited `PrismaPromise`, so a
 * caller can put it in a `$transaction` (e.g. with an unlink).
 */
export function supersedePending(
    ctx: Pick<OrgServiceContext, "prisma" | "organizationId">,
    target: PlanTarget,
): Prisma.PrismaPromise<Prisma.BatchPayload> {
    return ctx.prisma.batchUpdatePlan.updateMany({
        where: { ...targetWhere(ctx, target), status: "Pending" },
        data: { status: "Superseded" },
    });
}

/**
 * Record a run's result. Conditional on the plan still being `Executing`, so a late finish after
 * cleanup marked the run `Failed` doesn't flip it back. Returns whether the plan was updated.
 */
export async function finish(
    ctx: Pick<OrgServiceContext, "prisma" | "organizationId">,
    planId: BatchUpdatePlanId,
    result: { status: "Completed" | "Failed"; outcomes: unknown; logBatchId?: string | null },
): Promise<boolean> {
    const { count } = await ctx.prisma.batchUpdatePlan.updateMany({
        where: { id: planId, organizationId: ctx.organizationId, status: "Executing" },
        data: {
            status: result.status,
            // The caller's schema has already shaped the outcomes as JSON.
            outcomes: result.outcomes as Prisma.InputJsonValue,
            logBatchId: result.logBatchId ?? null,
            completedAt: new Date(),
        },
    });
    return count > 0;
}

export interface CleanupResult {
    /** Stale `Executing` plans marked `Failed`. */
    failed: number;
    /** Plans older than `PLAN_TTL_MS` deleted. */
    deleted: number;
}

/**
 * The daily cleanup, across every organization: mark stale executions `Failed`, then delete every
 * plan older than `PLAN_TTL_MS` that isn't `Executing`. Completed plans aren't kept; the
 * `LogBatch` records what happened.
 */
export async function runCleanup(prisma: PrismaClient, now: Date): Promise<CleanupResult> {
    const failed = await prisma.batchUpdatePlan.updateMany({
        where: { status: "Executing", executionStartedAt: { lte: ago(now, EXECUTION_STALE_MS) } },
        data: { status: "Failed", completedAt: now },
    });
    const deleted = await prisma.batchUpdatePlan.deleteMany({
        where: {
            status: { in: ["Pending", "Completed", "Failed", "Superseded"] },
            createdAt: { lte: ago(now, PLAN_TTL_MS) },
        },
    });
    return { failed: failed.count, deleted: deleted.count };
}
