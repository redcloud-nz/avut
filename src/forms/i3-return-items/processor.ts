/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { createElement } from "react";

import I3ReturnItemsNotificationEmail from "@/emails/i3-return-items-notification";
import I3ReturnItemsReceiptEmail from "@/emails/i3-return-items-receipt";
import { ValidationError } from "@/lib/errors";
import { getConfiguredD4HAccessToken } from "@/server/d4h-access-token";
import { requireD4HTeamPermission } from "@/server/d4h-permissions";
import { NoReplyEmailAddress, sendEmail } from "@/server/email";
import { FormProcessingPipeline } from "@/server/form-processor";
import * as I3Notifications from "@/server/services/i3-notifications";
import { AuthenticatedOrganizationContext } from "@/trpc/init";

import { returnItems } from "./return-items";
import { I3ReturnItemsFormData } from "./schema";

/**
 * Process the submission of the I3 Return Items form: for each item, queue a task to retire it by
 * hand in D4H, noting who recorded it, then notify the configured personnel and send the member
 * a receipt.
 *
 * The checks and the tasks are `returnItems`, shared with the item page's quick Return; this
 * pipeline adds the up-front permission check, the notification emails and the receipt.
 *
 * When no item could be returned, the `ReturnItems` stage throws a `ValidationError` listing the
 * failures, so the draft stays a Draft and no email goes out.
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
            const { recipient, items, comments } = ctx.formData;

            const result = await returnItems(ctx, {
                accessToken,
                recipient,
                items,
                comments,
                formInstanceId: ctx.formInstanceId,
            });

            // Nothing was returned: fail the pipeline so the draft stays a Draft (to fix and
            // resubmit) and the form reports why, rather than "succeeding" with zero items.
            if (result.returned === 0 && result.failures.length > 0) {
                throw new ValidationError(`No items were returned. ${result.failures.join("; ")}`);
            }

            return result;
        },
    })
    .stage({
        stageName: "NotifyPersonnel",
        stageFn: async (ctx, { returnedItems, failures }) => {
            // Email the org's and the returning member's team's notify lists, one copy each. The
            // tasks are already queued, so a failure here mustn't report the Return as failed (or
            // leave its draft un-Processed). Log it and carry on.
            try {
                const recipients = await I3Notifications.resolveNotifyRecipients(ctx, {
                    d4hTeamId: ctx.formData.recipient.teamId,
                });
                await I3Notifications.sendEach(recipients, (recipient) => ({
                    from: NoReplyEmailAddress,
                    to: recipient.email,
                    subject: "Items Returned by " + ctx.formData.recipient.name,
                    react: createElement(I3ReturnItemsNotificationEmail, {
                        recordedBy: { name: ctx.auth.user.name },
                        emailTarget: { email: recipient.email },
                        formData: ctx.formData,
                        returnedItems,
                        failures,
                    }),
                }));
            } catch (err) {
                ctx.logger.error("Failed to send the Return Items notification emails", err);
            }
        },
    })
    .stage({
        stageName: "SendReceipt",
        stageFn: async (ctx, { accessToken, returnedItems }) => {
            // Send the member a receipt at their D4H email, listing only the items returned. A
            // failure is logged, not thrown.
            try {
                const address = await I3Notifications.fetchReceiptAddress(accessToken, {
                    d4hTeamId: ctx.formData.recipient.teamId,
                    memberId: ctx.formData.recipient.id,
                });
                if (address === null) {
                    ctx.logger.info(
                        `No D4H email for member ${ctx.formData.recipient.id}; skipping the receipt`,
                    );
                    return;
                }
                await sendEmail({
                    from: NoReplyEmailAddress,
                    to: address,
                    subject: "Receipt for items you returned",
                    react: createElement(I3ReturnItemsReceiptEmail, {
                        recordedBy: { name: ctx.auth.user.name },
                        emailTarget: { email: address },
                        formData: ctx.formData,
                        returnedItems,
                    }),
                });
            } catch (err) {
                ctx.logger.error("Failed to send the Return Items receipt email", err);
            }
        },
    })
    .build();
