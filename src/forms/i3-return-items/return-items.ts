/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import * as z from "zod";

import { AVUTLogger } from "@/lib/logger";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { FormInstanceId } from "@/lib/schemas/form-instance";
import { getD4HFetchClient, type D4HListResponse } from "@/server/d4h-api/client";
import { fetchD4HEquipmentItem } from "@/server/d4h-api/equipment";
import { createLogBatch, formatActorLabel } from "@/server/log-entry";
import * as D4HTasks from "@/server/services/d4h-tasks";
import { withBatch, type OrgServiceContext } from "@/server/services/service-context";

import { I3ReturnedItem } from "./schema";

/** The reason recorded on each retire task a Return queues. Free text shown to whoever applies it. */
const RETIRE_REASON = "Returned To Cache";

/**
 * What `returnItems` needs from its caller: an org service context plus the signed-in user, who
 * is recorded as having received the items. A form pipeline stage passes its own `logger`.
 */
export type ReturnItemsContext = OrgServiceContext & {
    auth: { user: { name: string; email: string } };
    logger?: AVUTLogger;
};

export interface ReturnItemsInput {
    accessToken: D4HAccessToken_ServerOnly;
    /** The D4H member returning the items ("Returned by"). */
    recipient: { id: number; teamId: number; name: string };
    items: I3ReturnedItem[];
    comments: string;
    /** The Return form that queued the tasks, when there is one. */
    formInstanceId?: FormInstanceId;
}

export interface ReturnItemsResult {
    returned: number;
    /** One line per item that wasn't returned, e.g. `#1234 Helmet: already retired`. */
    failures: string[];
    /** The returned items, labelled from D4H. */
    returnedItems: I3ReturnedItem[];
}

/**
 * Return items held by a D4H member: for each item, check it and queue a task to retire it by hand
 * in D4H, noting who received it. Shared by the Return form's processor and the item page's quick
 * Return.
 *
 * A Return makes no write to D4H itself. Teams differ in what they do with a returned item (some
 * retire it, some only take it off the person), so the whole D4H change is the queued task.
 *
 * An item is skipped, with a failure line, when it's missing or on another team, not held by the
 * recipient, already `RETIRED`, or already has an open retire task. Keeps going past a failed item.
 */
export async function returnItems(
    ctx: ReturnItemsContext,
    { accessToken, recipient, items, comments, formInstanceId }: ReturnItemsInput,
): Promise<ReturnItemsResult> {
    const logger = ctx.logger ?? AVUTLogger.getConsoleLogger("returnItems");
    const teamId = recipient.teamId;

    const heldItemIds = await fetchMemberCurrentItemIds(
        accessToken,
        teamId,
        recipient.id,
        items.map((item) => item.itemId),
    );

    // Carried on each retire task for whoever applies it. A Return makes no D4H write, so the
    // task is the only place who received the item and the comments are kept.
    const note =
        `Returned via AVUT, received by ${ctx.auth.user.name}.` +
        (comments.trim() ? ` ${comments.trim()}` : "");

    // The batch opens on the first task queued, so a Return where every item fails leaves no
    // empty batch behind.
    let batchCtx: OrgServiceContext | null = null;
    async function openBatch(): Promise<OrgServiceContext> {
        if (batchCtx) return batchCtx;
        const batch = await createLogBatch(
            {
                operationKey: "i3-return-items",
                userId: ctx.userId,
                actorLabel: formatActorLabel(ctx.auth.user.name, ctx.auth.user.email),
                description: `Returned items from ${recipient.name}`,
            },
            ctx.prisma,
        );
        batchCtx = withBatch<OrgServiceContext>(ctx, batch.id);
        return batchCtx;
    }

    const returnedItems: I3ReturnedItem[] = [];
    const failures: string[] = [];
    for (const item of items) {
        // The caller's label stands in only until the item is fetched; from then on the label
        // comes from D4H.
        let label = `#${item.ref} ${item.kindTitle}`;
        try {
            const before = await fetchD4HEquipmentItem(accessToken, teamId, item.itemId);
            if (before == null || before.owner.id !== teamId) {
                failures.push(`${label}: not found in D4H`);
                continue;
            }
            label = `#${before.ref} ${before.kind.title}`;
            if (!heldItemIds.has(item.itemId)) {
                failures.push(`${label}: not held by ${recipient.name}`);
                continue;
            }
            if (before.status === "RETIRED") {
                failures.push(`${label}: already retired`);
                continue;
            }
            if (await D4HTasks.hasOpenRetireTask(ctx, { d4hTeamId: teamId, itemId: item.itemId })) {
                failures.push(`${label}: already has an open retire task`);
                continue;
            }

            // The task's Create log entry is the record of the return.
            await D4HTasks.createRetireTask(await openBatch(), {
                d4hTeamId: teamId,
                itemId: item.itemId,
                itemLabel: label,
                reason: RETIRE_REASON,
                note,
                formInstanceId,
            });

            returnedItems.push({ ...item, ref: before.ref, kindTitle: before.kind.title });
        } catch (err) {
            logger.error(`Failed to return ${label}`, err);
            failures.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    return { returned: returnedItems.length, failures, returnedItems };
}

/**
 * Which of the given items a member currently holds. Read from a `member_id`-filtered list,
 * narrowed to those ids, rather than from each item's `location` (see `D4HEquipmentItemDetail`).
 */
async function fetchMemberCurrentItemIds(
    accessToken: D4HAccessToken_ServerOnly,
    teamId: number,
    memberId: number,
    itemIds: number[],
): Promise<Set<number>> {
    const { data, error, response } = await getD4HFetchClient(accessToken).GET(
        "/v3/{context}/{contextId}/equipment",
        {
            params: {
                path: { context: "team", contextId: teamId },
                query: {
                    id: itemIds,
                    size: itemIds.length,
                    only_current: true,
                    member_id: memberId,
                },
            },
        },
    );

    // `error` is undefined for a non-ok response with an empty body.
    if (!response.ok) {
        throw new Error(
            `Failed to fetch equipment for member ${memberId} in team ${teamId}: ${response.status} ${response.statusText}`,
            { cause: error },
        );
    }

    const results = z.array(z.object({ id: z.number() })).parse((data as D4HListResponse).results);
    return new Set(results.map((item) => item.id));
}
