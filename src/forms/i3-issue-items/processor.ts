/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { createElement } from "react";

import I3IssueItemsNotificationEmail from "@/emails/i3-issue-items-notification";
import { getConfiguredD4HAccessToken } from "@/server/d4h-access-token";
import { fetchD4HWhoami, getD4HFetchClient } from "@/server/d4h-api/client";
import { NoReplyEmailAddress, sendEmail } from "@/server/email";
import { FormProcessingPipeline } from "@/server/form-processor";
import { AuthenticatedOrganizationContext } from "@/trpc/init";

import { I3IssueItemsFormData } from "./schema";

/**
 * Process for handling the submission of the I3 Issue Items form, including validating data, checking permissions, and performing necessary actions to record the issued items and notify relevant parties.
 */
export const I3IssueItemsFormProcessor = FormProcessingPipeline.builder<
    I3IssueItemsFormData,
    AuthenticatedOrganizationContext
>("I3IssueItemsFormProcessor")
    .stage({
        stageName: "CheckD4HAccessToken",
        stageFn: async (ctx) => {
            // Throws when the D4H integration is disabled or the user has no personal token.
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);

            return { accessToken };
        },
    })
    .stage({
        stageName: "ProcessItems",
        stageFn: async (ctx) => {
            // Get all of the templates configured for the organization, minus any in the Rubbish bin.
            const templates = await ctx.prisma.i3Template.findMany({
                where: { organizationId: ctx.organizationId, status: { not: "Deleted" } },
                include: { d4h: true, variants: { include: { d4h: true } } },
            });

            const items = ctx.formData.items.map((item) => {
                // Ensure that the specified template exists
                const template = templates.find((t) => t.id === item.template.id);
                if (!template)
                    throw new Error(
                        `Template with ID ${item.template.id} not found for organization`,
                    );

                // Ensure that the template has a d4h configuration.
                const { d4h: templateD4H, ...templateRest } = template;
                if (templateD4H == null)
                    throw new Error(
                        `Template with ID ${item.template.id} does not have D4H configuration`,
                    );

                // Ensure that the variant (if specified) exists and has a d4h configuration.
                const variant = template.variants.find((v) => v.id === item.variant?.id);
                if (item.variant && !variant)
                    throw new Error(
                        `Variant with ID ${item.variant.id} not found in template ${item.template.id}`,
                    );

                if (variant && !variant.d4h)
                    throw new Error(
                        `Variant with ID ${variant.id} does not have D4H configuration`,
                    );

                return {
                    template: { ...templateRest, d4h: templateD4H },
                    variant: variant ? { ...variant, d4h: variant.d4h } : null,
                    serialNumber: item.serialNumber,
                };
            });

            return { items };
        },
    })
    .stage({
        stageName: "CheckPermissions",
        stageFn: async (ctx, { accessToken }) => {
            // Check if the user has permission to create equipment in D4H for the recipient team, which is required to save issued items to D4H.
            // Uncached: an authorization decision must not rest on a whoami that may be hours old.
            const whoami = await fetchD4HWhoami(accessToken);

            const userMembershipInRecipientTeam = whoami.members.find(
                (m) => m.owner.id === ctx.formData.recipient.teamId,
            );

            const canCreateEquipment =
                userMembershipInRecipientTeam?.permissions?.Equipment?.CREATE === true;

            return { canCreateEquipment };
        },
    })
    .conditionalStage({
        stageName: "CreateEquipmentInD4H",
        test: (ctx, { canCreateEquipment }) => canCreateEquipment === true,
        stageFn: async (ctx, { accessToken, items }) => {
            // User has permission to create equipment in D4H for the recipient team, so create equipment records for each issued item in D4H.

            const fetchClient = getD4HFetchClient(accessToken);

            // For each item being issued, create a corresponding equipment record in D4H. Keep going
            // past a failed item: the ones already created can't be rolled back, so record as many
            // as D4H accepts and report the rest.
            const failures: string[] = [];
            for (const item of items) {
                try {
                    const { error, response } = await fetchClient.POST(
                        "/v3/{context}/{contextId}/equipment",
                        {
                            params: {
                                path: {
                                    context: "team",
                                    contextId: ctx.formData.recipient.teamId,
                                },
                            },
                            body: {
                                ref: undefined,
                                categoryId: item.template.d4h.categoryId,
                                kindId: item.template.d4h?.kindId,
                                location: {
                                    id: ctx.formData.recipient.id,
                                    resourceType: "Member",
                                },
                                serial: item.serialNumber ? item.serialNumber : undefined,
                                brandId: item.variant?.d4h?.brandId ?? undefined,
                                modelId: item.variant?.d4h?.modelId ?? undefined,
                            },
                        },
                    );
                    if (!response.ok) {
                        ctx.logger.error(
                            `Failed to create equipment in D4H (status ${response.status})`,
                            error,
                        );
                        failures.push(String(response.status));
                    }
                } catch (err) {
                    ctx.logger.error("Failed to create equipment in D4H", err);
                    failures.push(err instanceof Error ? err.message : String(err));
                }
            }

            if (failures.length === 0) return { savedToD4H: true as const };

            // Worded to cover a thrown network error as well as a D4H rejection, and without its
            // own "in D4H": the email's sentences ("…recorded in D4H, due to ___.") already say it.
            return {
                savedToD4H: {
                    reason: `failing to record ${failures.length} of ${items.length} items (first error: ${failures[0]})`,
                    partial: failures.length < items.length,
                },
            };
        },
    })
    .stage({
        stageName: "NotifyAdmin",
        stageFn: async (ctx, { savedToD4H }) => {
            await sendEmail({
                from: NoReplyEmailAddress,
                to: "delivered+i3-notify@resend.dev",
                subject: "Items Issued to " + ctx.formData.recipient.name,
                react: createElement(I3IssueItemsNotificationEmail, {
                    issuer: {
                        name: ctx.auth.user.name,
                    },
                    emailTarget: { email: "delivered+i3-notify@resend.dev" },
                    formData: ctx.formData,
                    savedToD4H: savedToD4H ?? { reason: "insufficient permissions" },
                }),
            });
        },
    })
    .build();
