/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { format } from "date-fns";
import { createElement } from "react";
import * as z from "zod";

import { TZDate } from "@date-fns/tz";

import I3ReturnItemsNotificationEmail from "@/emails/i3-return-items-notification";
import { diffObject } from "@/lib/diff";
import { D4HAccessToken_ServerOnly } from "@/lib/schemas/d4h-access-token";
import { getConfiguredD4HAccessToken, toD4HCredentialRef } from "@/server/d4h-access-token";
import {
    fetchD4HTeamDetailCached,
    getD4HFetchClient,
    type D4HListResponse,
} from "@/server/d4h-api/client";
import { fetchD4HEquipmentItem, patchD4HEquipmentItem } from "@/server/d4h-api/equipment";
import { requireD4HTeamPermission } from "@/server/d4h-permissions";
import { NoReplyEmailAddress, sendEmail } from "@/server/email";
import { FormProcessingPipeline } from "@/server/form-processor";
import { createLogBatch, formatActorLabel } from "@/server/log-entry";
import * as D4HTasks from "@/server/services/d4h-tasks";
import { withBatch, type OrgServiceContext } from "@/server/services/service-context";
import { AuthenticatedOrganizationContext } from "@/trpc/init";

import { I3ReturnedItem, I3ReturnItemsFormData } from "./schema";

/** The reason recorded on each retire task a Return queues. Free text shown to whoever applies it. */
const RETIRE_REASON = "Returned To Cache";

/**
 * Process the submission of the I3 Return Items form: for each item, mark it Non Operational
 * (`INACTIVE`) in D4H with a note saying who returned it, queue a task to retire it by hand in
 * D4H (the API can't), and notify the admin.
 *
 * The `ReturnItems` stage's `returned` and `failures` are what the caller reports back; the rest
 * of the output (the access token included) stays on the server.
 */
export const I3ReturnItemsFormProcessor = FormProcessingPipeline.builder<
    I3ReturnItemsFormData,
    AuthenticatedOrganizationContext
>("I3ReturnItemsFormProcessor")
    .stage({
        stageName: "CheckD4HAccessToken",
        stageFn: async (ctx) => {
            // Throws when the D4H integration is disabled or the user has no personal token.
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            return { accessToken };
        },
    })
    .stage({
        stageName: "CheckPermissions",
        stageFn: async (ctx, { accessToken }) => {
            // Refuse up front, before anything is written, when the user can't update equipment
            // in D4H for the returning member's team. Throws a ForbiddenError naming the team.
            await requireD4HTeamPermission(
                accessToken,
                ctx.formData.recipient.teamId,
                "Equipment",
                "UPDATE",
            );
        },
    })
    .stage({
        stageName: "ReturnItems",
        stageFn: async (ctx, { accessToken }) => {
            const { recipient, comments } = ctx.formData;
            const teamId = recipient.teamId;

            const [heldItemIds, team] = await Promise.all([
                fetchMemberCurrentItemIds(accessToken, teamId, recipient.id),
                fetchD4HTeamDetailCached(toD4HCredentialRef(accessToken), teamId),
            ]);

            const date = format(new TZDate(new Date(), team.timezone), "d MMM yyyy");
            const noteLine =
                `Returned by ${recipient.name} via AVUT on ${date}, received by ${ctx.auth.user.name}.` +
                (comments.trim() ? ` ${comments.trim()}` : "");

            // The batch opens on the first successful PATCH, so a Return where every item fails
            // leaves no empty batch behind.
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

            // Keep going past a failed item: the ones already changed in D4H can't be rolled
            // back, so return as many as possible and report the rest.
            const returnedItems: I3ReturnedItem[] = [];
            const failures: string[] = [];
            for (const item of ctx.formData.items) {
                const label = itemLabel(item);
                try {
                    const before = await fetchD4HEquipmentItem(accessToken, teamId, item.itemId);
                    if (before == null || before.owner.id !== teamId) {
                        failures.push(`${label}: not found in D4H`);
                        continue;
                    }
                    if (!heldItemIds.has(item.itemId)) {
                        failures.push(`${label}: not held by ${recipient.name}`);
                        continue;
                    }
                    if (before.status === "RETIRED") {
                        failures.push(`${label}: already retired`);
                        continue;
                    }
                    if (
                        await D4HTasks.hasOpenRetireTask(ctx, {
                            d4hTeamId: teamId,
                            itemId: item.itemId,
                        })
                    ) {
                        failures.push(`${label}: already has an open retire task`);
                        continue;
                    }

                    // D4H writes can't join a Prisma transaction: PATCH first, then write the
                    // log and the task once it has succeeded.
                    const notes = before.notes ? `${before.notes}\n${noteLine}` : noteLine;
                    await patchD4HEquipmentItem(accessToken, teamId, item.itemId, {
                        status: "INACTIVE",
                        notes,
                        updateNotes: noteLine,
                    });

                    const logCtx = await openBatch();
                    try {
                        await logCtx.logEvent({
                            action: "Update",
                            objectType: "D4HEquipmentItem",
                            objectId: String(item.itemId),
                            changes: diffObject(
                                { status: before.status, notes: before.notes },
                                { status: "INACTIVE", notes },
                            ),
                            description: `Returned ${label} from ${recipient.name}.`,
                        });
                        await D4HTasks.createRetireTask(logCtx, {
                            d4hTeamId: teamId,
                            itemId: item.itemId,
                            itemLabel: label,
                            reason: RETIRE_REASON,
                            formInstanceId: ctx.formInstanceId,
                        });
                    } catch (err) {
                        // The D4H change stands; returning the item again re-queues the task.
                        ctx.logger.error(`Failed to record the return of ${label}`, err);
                        failures.push(
                            `${label}: marked Non Operational in D4H, but its retire task wasn't queued`,
                        );
                        continue;
                    }

                    returnedItems.push(item);
                } catch (err) {
                    ctx.logger.error(`Failed to return ${label}`, err);
                    failures.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }

            return { returned: returnedItems.length, failures, returnedItems };
        },
    })
    .stage({
        stageName: "NotifyAdmin",
        stageFn: async (ctx, { returnedItems, failures }) => {
            await sendEmail({
                from: NoReplyEmailAddress,
                to: "delivered+i3-notify@resend.dev",
                subject: "Items Returned by " + ctx.formData.recipient.name,
                react: createElement(I3ReturnItemsNotificationEmail, {
                    receiver: { name: ctx.auth.user.name },
                    emailTarget: { email: "delivered+i3-notify@resend.dev" },
                    formData: ctx.formData,
                    returnedItems,
                    failures,
                }),
            });
        },
    })
    .build();

/** `#<ref> <kind>`, as the retire task and the failure lines label an item. */
function itemLabel(item: I3ReturnedItem): string {
    return `#${item.ref} ${item.kindTitle}`;
}

/**
 * The ids of the items a member currently holds. Read from a `member_id`-filtered list because
 * the item schema strips `location` (see `D4HEquipmentItemDetail`).
 */
async function fetchMemberCurrentItemIds(
    accessToken: D4HAccessToken_ServerOnly,
    teamId: number,
    memberId: number,
): Promise<Set<number>> {
    const { data, error, response } = await getD4HFetchClient(accessToken).GET(
        "/v3/{context}/{contextId}/equipment",
        {
            params: {
                path: { context: "team", contextId: teamId },
                query: { size: 10000, only_current: true, member_id: memberId },
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
