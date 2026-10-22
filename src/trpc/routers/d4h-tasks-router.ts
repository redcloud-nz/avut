/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { hasD4HTeamPermission } from "@/lib/d4h-permissions";
import { d4hEquipmentItemUrl } from "@/lib/d4h-servers";
import { D4HTask, D4HTaskId } from "@/lib/schemas/d4h-task";
import { getConfiguredD4HAccessToken, toD4HCredentialRef } from "@/server/d4h-access-token";
import { fetchD4HTeamDetailCached, fetchD4HWhoamiCached } from "@/server/d4h-api/client";
import { fetchD4HEquipmentItem } from "@/server/d4h-api/equipment";
import { requireD4HTeamPermission } from "@/server/d4h-permissions";
import * as D4HTasks from "@/server/services/d4h-tasks";

import { createTrpcRouter, organizationProcedure } from "../init";

/**
 * Changes the D4H API can't make (v1: retiring an equipment item), queued to be applied by hand in
 * D4H's web app. Seeing, checking or dismissing a task also needs D4H's Equipment RETIRE
 * permission on the task's team.
 */
export const d4hTasksRouter = createTrpcRouter({
    /**
     * Re-fetch the task's item from D4H and close the task if the change has been applied there.
     * @returns `missing` when D4H no longer has the item (suggest Dismiss), `applied` when the item
     *   is retired (the task is now `Done`), or `pending` with the item's current D4H status.
     */
    checkTask: organizationProcedure({ i3Item: ["update"] })
        .input(z.object({ taskId: D4HTaskId.schema }))
        .output(
            z.discriminatedUnion("result", [
                z.object({ result: z.literal("missing") }),
                z.object({ result: z.literal("applied"), task: D4HTask.schema }),
                z.object({ result: z.literal("pending"), status: z.string() }),
            ]),
        )
        .mutation(async ({ ctx, input: { taskId } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const task = await D4HTasks.requireById(ctx, taskId);
            await requireD4HTeamPermission(accessToken, task.d4hTeamId, "Equipment", "RETIRE");

            const item = await fetchD4HEquipmentItem(accessToken, task.d4hTeamId, task.resourceId);
            if (!item) return { result: "missing" as const };

            if (item.status === "RETIRED") {
                return {
                    result: "applied" as const,
                    task: await D4HTasks.markApplied(ctx, taskId),
                };
            }

            return { result: "pending" as const, status: item.status };
        }),

    /**
     * Close a task without applying it, e.g. for an item already handled or deleted in D4H.
     */
    dismissTask: organizationProcedure({ i3Item: ["update"] })
        .input(z.object({ taskId: D4HTaskId.schema }))
        .output(z.object({ dismissed: D4HTask.schema }))
        .mutation(async ({ ctx, input: { taskId } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const task = await D4HTasks.requireById(ctx, taskId);
            await requireD4HTeamPermission(accessToken, task.d4hTeamId, "Equipment", "RETIRE");

            return { dismissed: await D4HTasks.dismiss(ctx, taskId) };
        }),

    /**
     * The open tasks on one D4H equipment item, or none when the viewer lacks D4H's Equipment
     * RETIRE permission on its team.
     */
    listItemTasks: organizationProcedure({ i3Item: ["update"] })
        .input(z.object({ teamId: z.number(), itemId: z.number() }))
        .output(z.array(D4HTask.schema))
        .query(async ({ ctx, input: { teamId, itemId } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            const whoami = await fetchD4HWhoamiCached(toD4HCredentialRef(accessToken));
            const membership = whoami.members.find((m) => m.owner.id === teamId);
            if (!hasD4HTeamPermission(membership?.permissions, "Equipment", "RETIRE")) return [];

            return D4HTasks.listForItem(ctx, { d4hTeamId: teamId, itemId });
        }),

    /**
     * The open tasks on every D4H team where the viewer holds D4H's Equipment RETIRE permission,
     * oldest first, each with its item's D4H web-app URL and its team's title.
     */
    listOpenTasks: organizationProcedure({ i3Item: ["update"] })
        .output(
            z.array(
                z.object({
                    task: D4HTask.schema,
                    d4hUrl: z.string(),
                    teamTitle: z.string(),
                }),
            ),
        )
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
            const credentialRef = toD4HCredentialRef(accessToken);

            const whoami = await fetchD4HWhoamiCached(credentialRef);
            const teamTitles = new Map(
                whoami.members
                    .filter((m) => hasD4HTeamPermission(m.permissions, "Equipment", "RETIRE"))
                    .map((m) => [m.owner.id, m.owner.title]),
            );

            const tasks = await D4HTasks.listOpen(ctx, { d4hTeamIds: [...teamTitles.keys()] });

            const teamIds = [...new Set(tasks.map((task) => task.d4hTeamId))];
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

            return tasks.map((task) => ({
                task,
                d4hUrl: d4hEquipmentItemUrl(
                    accessToken.serverCode,
                    subdomains.get(task.d4hTeamId)!,
                    task.resourceId,
                ),
                teamTitle: teamTitles.get(task.d4hTeamId)!,
            }));
        }),

    /**
     * The D4H ids of a team's equipment items that have an open Retire task, for the "Returned"
     * badge. Reads AVUT's own records only, so it needs no D4H token. Gated like the D4H equipment
     * it annotates, since it exposes only item ids.
     */
    listReturnedItemIds: organizationProcedure({ d4hEquipment: ["view"] })
        .input(z.object({ teamId: z.number() }))
        .output(z.array(z.number()))
        .query(async ({ ctx, input: { teamId } }) => {
            return D4HTasks.listOpenRetireItemIds(ctx, { d4hTeamId: teamId });
        }),
});
