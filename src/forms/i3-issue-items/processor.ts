/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { getPersonalD4HAccessTokenForUser } from "@/server/d4h-access-token";
import { AuthenticatedOrganizationContext } from "@/trpc/init";

import { I3IssueItemsFormData } from "./schema";
import { FormProcessingPipeline } from "@/server/form-processor";
import { fetchD4HWhoamiCached, getD4HFetchClient } from "@/server/d4h-api/client";
import { NoReplyEmailAddress, sendEmail } from "@/server/email";
import { createElement } from "react";
import I3IssueItemsNotificationEmail from "@/emails/i3-issue-items-notification";

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
            const accessToken = await getPersonalD4HAccessTokenForUser(
                ctx.organizationId,
                ctx.userId,
            );

            if (!accessToken) {
                throw new Error("User does not have a personal D4H Access Token configured");
            }

            return { accessToken };
        },
    })
    .stage({
        stageName: "ProcessItems",
        stageFn: async (ctx) => {
            // Get all of the templates configured for the organization.
            const templates = await ctx.prisma.i3Template.findMany({
                where: { organizationId: ctx.organizationId },
                include: { d4h: true, variants: { include: { d4h: true } } },
            });

            const items = ctx.formData.items.map((item) => {
                // Ensure that the specified template exists
                let template = templates.find((t) => t.id === item.template.id);
                if (!template)
                    throw new Error(
                        `Template with ID ${item.template.id} not found for organization`,
                    );

                // Ensure that the template has a d4h configuration.
                const { d4h: templateD4H, variants, ...templateRest } = template;
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
            const whoami = await fetchD4HWhoamiCached(accessToken);

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

            // For each item being issued, create a corresponding equipment record in D4H if the user has permission to do so.
            const createdEquipmentIds: number[] = [];
            for (const item of items) {
                await fetchClient.POST("/v3/{context}/{contextId}/equipment", {
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
                });
            }

            return { savedToD4H: true } as const;
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
                    savedToD4H: savedToD4H ?? { reason: "Insufficient permissions" },
                }),
            });
        },
    })
    .build();
