/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { hasD4HTeamPermission, type D4HPermissionAction } from "@/lib/d4h-permissions";
import { d4hEquipmentItemUrl } from "@/lib/d4h-servers";
import type { D4HTeamPermissions } from "@/lib/schemas/d4h-provider-metadata";
import { D4HTask, D4HTaskId, type D4HTaskKind } from "@/lib/schemas/d4h-task";
import type { D4HEquipmentItemDetail } from "@/lib/schemas/d4h/equipment-item";
import { getConfiguredD4HAccessToken, toD4HCredentialRef } from "@/server/d4h-access-token";
import { fetchD4HTeamDetailCached, fetchD4HWhoamiCached } from "@/server/d4h-api/client";
import { fetchD4HEquipmentItem } from "@/server/d4h-api/equipment";
import { requireD4HTeamPermission } from "@/server/d4h-permissions";
import * as D4HTasks from "@/server/services/d4h-tasks";

import { createTrpcRouter, organizationProcedure } from "../init";

/**
 * Changes to D4H equipment queued to be applied by hand in D4H's web app: retiring an item (the
 * API can't), and a Self Audit Campaign's serial and brand/model fixes, and its LOST fix when the
 * token lacks Equipment UPDATE. Seeing, checking or dismissing a task also needs the D4H permission
 * its kind's change needs on the task's team (`requiredD4HPermission`): Equipment RETIRE for
 * `Retire`, UPDATE for the other kinds.
 */
export const d4hTasksRouter = createTrpcRouter({
    /**
     * Re-fetch the task's item from D4H and close the task if its change has been applied there:
     * `Retire` when the item is retired, `SetSerial` when its serial matches, `SetVariant` when its
     * brand and model titles match, `MarkLost` when it's LOST. Checking needs the D4H permission
     * the change itself needs: Equipment RETIRE for `Retire`, UPDATE for the other kinds.
     * @returns `missing` when D4H no longer has the item (suggest Dismiss), `applied` when the
     *   change is in D4H (the task is now `Done`), or `pending` with the item's current D4H status,
     *   serial, brand and model.
     */
    checkTask: organizationProcedure({ d4hTask: ["apply"] })
        .input(z.object({ taskId: D4HTaskId.schema }))
        .output(
            z.discriminatedUnion("result", [
                z.object({ result: z.literal("missing") }),
                z.object({ result: z.literal("applied"), task: D4HTask.schema }),
                z.object({
                    result: z.literal("pending"),
                    status: z.string(),
                    serial: z.string().nullable(),
                    brand: z.string().nullable(),
                    model: z.string().nullable(),
                }),
            ]),
        )
        .mutation(async ({ ctx, input: { taskId } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            // A stale list (e.g. in another tab) can offer a task that's already closed: refuse
            // before any D4H call.
            const task = await D4HTasks.requireOpen(ctx, taskId);
            await requireD4HTeamPermission(
                accessToken,
                task.d4hTeamId,
                "Equipment",
                requiredD4HPermission(task.kind),
            );

            const item = await fetchD4HEquipmentItem(accessToken, task.d4hTeamId, task.resourceId);
            // An item another team owns (a stale or mistyped id) is as good as missing here.
            if (!item || item.owner.id !== task.d4hTeamId) return { result: "missing" as const };

            if (isTaskApplied(task, item)) {
                return {
                    result: "applied" as const,
                    task: await D4HTasks.markApplied(ctx, taskId),
                };
            }

            return {
                result: "pending" as const,
                status: item.status,
                serial: item.serial,
                brand: item.brand.title ?? null,
                model: item.model?.title ?? null,
            };
        }),

    /**
     * Close a task without applying it, e.g. for an item already handled or deleted in D4H. Needs
     * the D4H permission the task's change needs, as `checkTask` does.
     */
    dismissTask: organizationProcedure({ d4hTask: ["apply"] })
        .input(z.object({ taskId: D4HTaskId.schema }))
        .output(z.object({ dismissed: D4HTask.schema }))
        .mutation(async ({ ctx, input: { taskId } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const task = await D4HTasks.requireById(ctx, taskId);
            await requireD4HTeamPermission(
                accessToken,
                task.d4hTeamId,
                "Equipment",
                requiredD4HPermission(task.kind),
            );

            return { dismissed: await D4HTasks.dismiss(ctx, taskId) };
        }),

    /**
     * The open tasks on one D4H equipment item whose D4H permission the viewer holds on its team
     * (`requiredD4HPermission`).
     */
    listItemTasks: organizationProcedure({ d4hTask: ["view"] })
        .input(z.object({ teamId: z.number().int(), itemId: z.number().int() }))
        .output(z.array(D4HTask.schema))
        .query(async ({ ctx, input: { teamId, itemId } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const whoami = await fetchD4HWhoamiCached(toD4HCredentialRef(accessToken));
            const membership = whoami.members.find((m) => m.owner.id === teamId);
            const permissions = membership?.permissions;
            if (!hasAnyTaskPermission(permissions)) return [];

            const tasks = await D4HTasks.listForItem(ctx, { d4hTeamId: teamId, itemId });
            return tasks.filter((task) => canSeeTask(permissions, task));
        }),

    /**
     * The open tasks whose D4H permission the viewer holds on the task's team
     * (`requiredD4HPermission`), oldest first, each with its item's D4H web-app URL and its team's
     * title.
     */
    listOpenTasks: organizationProcedure({ d4hTask: ["view"] })
        .output(
            z.array(
                z.object({
                    task: D4HTask.schema,
                    /** Null once the requester's account has been purged. */
                    requestedByName: z.string().nullable(),
                    d4hUrl: z.string(),
                    teamTitle: z.string(),
                }),
            ),
        )
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
            const credentialRef = toD4HCredentialRef(accessToken);

            const whoami = await fetchD4HWhoamiCached(credentialRef);
            const members = new Map(
                whoami.members
                    .filter((m) => hasAnyTaskPermission(m.permissions))
                    .map((m) => [m.owner.id, m]),
            );

            const rows = (await D4HTasks.listOpen(ctx, { d4hTeamIds: [...members.keys()] })).filter(
                ({ task }) => canSeeTask(members.get(task.d4hTeamId)?.permissions, task),
            );

            const teamIds = [...new Set(rows.map(({ task }) => task.d4hTeamId))];
            const subdomains = new Map(
                await Promise.all(
                    teamIds.map(
                        async (teamId) =>
                            [
                                teamId,
                                (await fetchD4HTeamDetailCached(credentialRef, teamId)).subdomain,
                            ] as const,
                    ),
                ),
            );

            return rows.map(({ task, requestedByName }) => ({
                task,
                requestedByName,
                d4hUrl: d4hEquipmentItemUrl(
                    accessToken.serverCode,
                    subdomains.get(task.d4hTeamId)!,
                    task.resourceId,
                ),
                teamTitle: members.get(task.d4hTeamId)!.owner.title,
            }));
        }),

    /**
     * The D4H ids of a team's equipment items that have an open Retire task, for the "Returned"
     * badge. Reads AVUT's own records only, so it needs no D4H token. Gated like the D4H equipment
     * it annotates, since it exposes only item ids.
     */
    listReturnedItemIds: organizationProcedure({ d4hEquipment: ["view"] })
        .input(z.object({ teamId: z.number().int() }))
        .output(z.array(z.number()))
        .query(async ({ ctx, input: { teamId } }) => {
            return D4HTasks.listOpenRetireItemIds(ctx, { d4hTeamId: teamId });
        }),
});

/**
 * The D4H Equipment permission a task's change needs, and so the one a viewer needs on the task's
 * team to see, check or dismiss it: RETIRE for `Retire`, UPDATE for the other kinds.
 */
function requiredD4HPermission(kind: D4HTaskKind): D4HPermissionAction {
    return kind === "Retire" ? "RETIRE" : "UPDATE";
}

/** Whether a team membership's permissions allow some task kind: Equipment RETIRE or UPDATE. */
function hasAnyTaskPermission(permissions: D4HTeamPermissions | undefined): boolean {
    return (
        hasD4HTeamPermission(permissions, "Equipment", "RETIRE") ||
        hasD4HTeamPermission(permissions, "Equipment", "UPDATE")
    );
}

/** Whether a team membership's permissions allow seeing `task` (`requiredD4HPermission`). */
function canSeeTask(permissions: D4HTeamPermissions | undefined, task: D4HTask): boolean {
    return hasD4HTeamPermission(permissions, "Equipment", requiredD4HPermission(task.kind));
}

/** Whether D4H's copy of the item shows the task's change. */
function isTaskApplied(task: D4HTask, item: D4HEquipmentItemDetail): boolean {
    switch (task.kind) {
        case "Retire":
            return item.status === "RETIRED";
        case "SetSerial":
            return (item.serial ?? "").trim() === task.payload.serial.trim();
        case "SetVariant":
            return (
                item.brand.title === task.payload.brand && item.model?.title === task.payload.model
            );
        case "MarkLost":
            return item.status === "LOST";
    }
}
