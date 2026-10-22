/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { diffObject } from "@/lib/diff";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { D4HTask, D4HTaskId, type D4HRetireTaskPayload } from "@/lib/schemas/d4h-task";

import type { OrgServiceContext } from "./service-context";

/**
 * Queue a task to retire a D4H equipment item by hand in D4H's web app (the API has no retire
 * endpoint).
 */
export async function createRetireTask(
    ctx: OrgServiceContext,
    args: {
        d4hTeamId: number;
        itemId: number;
        itemLabel: string;
        reason: D4HRetireTaskPayload["reason"];
        formInstanceId?: string;
    },
): Promise<D4HTask> {
    const id = D4HTaskId.create();
    const payload: D4HRetireTaskPayload = { reason: args.reason };

    const [created] = await ctx.prisma.$transaction([
        ctx.prisma.d4HTask.create({
            data: {
                id,
                organizationId: ctx.organizationId,
                d4hTeamId: args.d4hTeamId,
                resourceType: "Equipment",
                resourceId: args.itemId,
                itemLabel: args.itemLabel,
                kind: "Retire",
                payload,
                status: "Open",
                applyMethod: "Manual",
                requestedById: ctx.userId,
                formInstanceId: args.formInstanceId ?? null,
            },
        }),
        ctx.logEvent({
            action: "Create",
            objectType: "D4HTask",
            objectId: id,
            description: `Queued D4H retire task for ${args.itemLabel}.`,
        }),
    ]);

    return D4HTask.fromRecord(created);
}

/**
 * The open tasks on the given D4H teams, oldest first, each with its requester's name (null once
 * the requester's account has been purged).
 */
export async function listOpen(
    ctx: OrgServiceContext,
    args: { d4hTeamIds: number[] },
): Promise<{ task: D4HTask; requestedByName: string | null }[]> {
    if (args.d4hTeamIds.length === 0) return [];

    const records = await ctx.prisma.d4HTask.findMany({
        where: {
            organizationId: ctx.organizationId,
            status: "Open",
            d4hTeamId: { in: args.d4hTeamIds },
        },
        include: { requestedBy: { select: { name: true } } },
        orderBy: { requestedAt: "asc" },
    });

    return records.map(({ requestedBy, ...record }) => ({
        task: D4HTask.fromRecord(record),
        requestedByName: requestedBy?.name ?? null,
    }));
}

/** The open tasks on one D4H equipment item, oldest first. */
export async function listForItem(
    ctx: OrgServiceContext,
    args: { d4hTeamId: number; itemId: number },
): Promise<D4HTask[]> {
    const records = await ctx.prisma.d4HTask.findMany({
        where: {
            organizationId: ctx.organizationId,
            status: "Open",
            d4hTeamId: args.d4hTeamId,
            resourceType: "Equipment",
            resourceId: args.itemId,
        },
        orderBy: { requestedAt: "asc" },
    });

    return records.map(D4HTask.fromRecord);
}

/** The D4H ids of a team's equipment items that have an open Retire task (the "Returned" badge). */
export async function listOpenRetireItemIds(
    ctx: OrgServiceContext,
    args: { d4hTeamId: number },
): Promise<number[]> {
    const records = await ctx.prisma.d4HTask.findMany({
        where: {
            organizationId: ctx.organizationId,
            status: "Open",
            kind: "Retire",
            d4hTeamId: args.d4hTeamId,
            resourceType: "Equipment",
        },
        select: { resourceId: true },
    });

    return [...new Set(records.map((record) => record.resourceId))];
}

/** Whether a D4H equipment item already has an open Retire task. */
export async function hasOpenRetireTask(
    ctx: OrgServiceContext,
    args: { d4hTeamId: number; itemId: number },
): Promise<boolean> {
    const count = await ctx.prisma.d4HTask.count({
        where: {
            organizationId: ctx.organizationId,
            status: "Open",
            kind: "Retire",
            d4hTeamId: args.d4hTeamId,
            resourceType: "Equipment",
            resourceId: args.itemId,
        },
    });

    return count > 0;
}

/**
 * Fetch a D4H task by ID and ensure it belongs to the organization.
 * @throws NotFoundError if the task does not exist within the organization.
 */
export async function requireById(ctx: OrgServiceContext, taskId: D4HTaskId): Promise<D4HTask> {
    const record = await ctx.prisma.d4HTask.findUnique({
        where: { id: taskId, organizationId: ctx.organizationId },
    });

    if (!record) {
        throw new NotFoundError(`D4HTask(id=${taskId}) not found.`);
    }

    return D4HTask.fromRecord(record);
}

/**
 * Mark an open task `Done`, recording the caller as whoever confirmed it was applied in D4H.
 * @throws NotFoundError if the task is not found in the organization.
 * @throws ConflictError if the task is not `Open`.
 */
export async function markApplied(ctx: OrgServiceContext, taskId: D4HTaskId): Promise<D4HTask> {
    const existing = await requireOpen(ctx, taskId);
    const appliedAt = new Date();

    const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.d4HTask.update({
            where: { id: taskId, organizationId: ctx.organizationId },
            data: { status: "Done", appliedById: ctx.userId, appliedAt },
        }),
        ctx.logEvent({
            action: "Update",
            objectType: "D4HTask",
            objectId: taskId,
            changes: diffObject({ status: existing.status }, { status: "Done" }),
            description: `Confirmed D4H task applied for ${existing.itemLabel}.`,
        }),
    ]);

    return D4HTask.fromRecord(updated);
}

/**
 * Close an open task without applying it (e.g. the item was already handled or deleted in D4H).
 * `appliedBy`/`appliedAt` stay null; the log entry records who dismissed it.
 * @throws NotFoundError if the task is not found in the organization.
 * @throws ConflictError if the task is not `Open`.
 */
export async function dismiss(ctx: OrgServiceContext, taskId: D4HTaskId): Promise<D4HTask> {
    const existing = await requireOpen(ctx, taskId);

    const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.d4HTask.update({
            where: { id: taskId, organizationId: ctx.organizationId },
            data: { status: "Dismissed" },
        }),
        ctx.logEvent({
            action: "Update",
            objectType: "D4HTask",
            objectId: taskId,
            changes: diffObject({ status: existing.status }, { status: "Dismissed" }),
            description: `Dismissed D4H task for ${existing.itemLabel}.`,
        }),
    ]);

    return D4HTask.fromRecord(updated);
}

async function requireOpen(ctx: OrgServiceContext, taskId: D4HTaskId): Promise<D4HTask> {
    const existing = await requireById(ctx, taskId);

    if (existing.status !== "Open") {
        throw new ConflictError(
            `D4HTask(id=${taskId}) is ${existing.status}; only an Open task can be changed.`,
        );
    }

    return existing;
}
