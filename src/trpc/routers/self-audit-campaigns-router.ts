/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { ForbiddenError } from "@/lib/errors";
import { I3BundleId, I3BundleSummary } from "@/lib/schemas/i3-bundle";
import {
    SELF_AUDIT_CAMPAIGN_NAME_MAX,
    SELF_AUDIT_RECIPIENTS_MAX,
    SelfAuditCampaignId,
    SelfAuditDeliveryStatus,
    SelfAuditHeldItem,
    SelfAuditRequestId,
    SelfAuditResponseData,
    SelfAuditStatus,
    SelfAuditTemplate,
} from "@/lib/schemas/self-audit";
import { TeamId } from "@/lib/schemas/team";
import { getConfiguredD4HAccessToken } from "@/server/d4h-access-token";
import * as SelfAuditCampaigns from "@/server/services/self-audit-campaigns";

import { createTrpcRouter, organizationProcedure } from "../init";

/**
 * Every self-audit procedure is for system admins only (decision 15 of
 * `docs/plans/2026-11-25-kit-check-send.md`, kept by decision 8 of the campaigns plan): an org
 * member without the Better Auth `admin` role is refused, whatever their org roles.
 */
const selfAuditProcedure = organizationProcedure({}, { allowSystemAdmin: true }).use(
    ({ ctx, next }) => {
        if (!ctx.isSystemAdmin)
            throw new ForbiddenError("Self audit campaigns are for system admins only.");
        return next();
    },
);

const SelfAuditCampaignSummary = z.object({
    id: SelfAuditCampaignId.schema,
    name: z.string(),
    team: z.object({ id: TeamId.schema, name: z.string() }),
    d4hTeamName: z.string(),
    bundleName: z.string(),
    sentAt: z.date().nullable(),
    sentByName: z.string().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    counts: z.record(SelfAuditStatus, z.number()),
});

/** A request as the admin pages see it. Deliberately has no token hash. */
const SelfAuditRequestSummary = z.object({
    id: SelfAuditRequestId.schema,
    d4hMemberId: z.number(),
    memberName: z.string(),
    email: z.string().nullable(),
    deliveryStatus: SelfAuditDeliveryStatus,
    sentAt: z.date().nullable(),
    openedAt: z.date().nullable(),
    submittedAt: z.date().nullable(),
    expiresAt: z.date().nullable(),
    withdrawnAt: z.date().nullable(),
    formStatus: z.string(),
    status: SelfAuditStatus,
});

const SelfAuditSendResult = z.object({
    campaignId: SelfAuditCampaignId.schema,
    sent: z.number(),
    failed: z.number(),
    noEmail: z.number(),
});

/** A campaign a member change was made to. */
const SelfAuditCampaignRef = z.object({ campaignId: SelfAuditCampaignId.schema });

export const selfAuditCampaignsRouter = createTrpcRouter({
    /**
     * Add members of the campaign's D4H team, or re-add withdrawn ones. On a Draft they wait for
     * the send; on a sent campaign they're emailed at once. Returns how many were added, sent,
     * failed, or had no email.
     *
     * @throws TRPCError(PRECONDITION_FAILED) if the caller has no personal D4H token here.
     * @throws TRPCError(NOT_FOUND) if the campaign isn't in the organization, or the token doesn't
     * reach its D4H team.
     * @throws TRPCError(BAD_REQUEST) if no member is given, one is already in the campaign, one
     * isn't in its D4H team, or it would have too many members.
     * @throws TRPCError(CONFLICT) if the campaign was sent meanwhile.
     */
    addMembers: selfAuditProcedure
        .input(
            z.object({
                campaignId: SelfAuditCampaignId.schema,
                d4hMemberIds: z.array(z.number().int()).min(1).max(SELF_AUDIT_RECIPIENTS_MAX),
            }),
        )
        .output(
            z.object({
                campaignId: SelfAuditCampaignId.schema,
                added: z.number(),
                sent: z.number(),
                failed: z.number(),
                noEmail: z.number(),
            }),
        )
        .mutation(async ({ ctx, input: { campaignId, d4hMemberIds } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
            return SelfAuditCampaigns.addMembers(ctx, { accessToken, campaignId, d4hMemberIds });
        }),

    /**
     * Create a Draft self audit campaign of the bundle, pinned to the team, with the bundle's
     * templates for the team's D4H team snapshotted and no members yet. Without a name, it's named
     * after the bundle and the month.
     *
     * @throws TRPCError(PRECONDITION_FAILED) if the caller has no personal D4H token here.
     * @throws TRPCError(NOT_FOUND) if the team or the bundle isn't in the organization, or the
     * token doesn't reach the team's D4H team.
     * @throws TRPCError(BAD_REQUEST) if the team isn't Active or has no D4H link, or the bundle is
     * Deleted.
     */
    createCampaign: selfAuditProcedure
        .input(
            z.object({
                teamId: TeamId.schema,
                bundleId: I3BundleId.schema,
                name: z.string().trim().max(SELF_AUDIT_CAMPAIGN_NAME_MAX).optional(),
            }),
        )
        .output(z.object({ campaignId: SelfAuditCampaignId.schema }))
        .mutation(async ({ ctx, input: { teamId, bundleId, name } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
            return SelfAuditCampaigns.createCampaign(ctx, { accessToken, teamId, bundleId, name });
        }),

    /**
     * Discard a Draft: delete it with its members and their forms.
     *
     * @throws TRPCError(NOT_FOUND) if the campaign isn't in the organization.
     * @throws TRPCError(BAD_REQUEST) if it has been sent.
     * @throws TRPCError(CONFLICT) if it was sent meanwhile.
     */
    discardCampaign: selfAuditProcedure
        .input(z.object({ campaignId: SelfAuditCampaignId.schema }))
        .output(SelfAuditCampaignRef)
        .mutation(async ({ ctx, input: { campaignId } }) => {
            return SelfAuditCampaigns.discardCampaign(ctx, campaignId);
        }),

    /**
     * A self audit campaign with every member's request: delivery, status and times.
     *
     * @throws TRPCError(NOT_FOUND) if the self audit campaign isn't in the organization.
     */
    getCampaign: selfAuditProcedure
        .input(z.object({ campaignId: SelfAuditCampaignId.schema }))
        .output(SelfAuditCampaignSummary.extend({ requests: z.array(SelfAuditRequestSummary) }))
        .query(async ({ ctx, input: { campaignId } }) => {
            return SelfAuditCampaigns.requireCampaignById(ctx, campaignId);
        }),

    /**
     * What the campaign's members need, from their submitted (and not withdrawn) answers: grouped
     * by template, variant and size, and the needs not on the list. Reads only AVUT.
     *
     * @throws TRPCError(NOT_FOUND) if the self audit campaign isn't in the organization.
     */
    getNeedsReport: selfAuditProcedure
        .input(z.object({ campaignId: SelfAuditCampaignId.schema }))
        .output(
            z.object({
                groups: z.array(
                    z.object({
                        templateId: z.string(),
                        templateName: z.string(),
                        category: z.string(),
                        variantLabel: z.string(),
                        size: z.string(),
                        count: z.number(),
                        members: z.array(z.string()),
                    }),
                ),
                extras: z.array(
                    z.object({
                        memberName: z.string(),
                        item: z.string(),
                        size: z.string(),
                        notes: z.string(),
                    }),
                ),
            }),
        )
        .query(async ({ ctx, input: { campaignId } }) => {
            return SelfAuditCampaigns.getNeedsReport(ctx, campaignId);
        }),

    /**
     * What one member was asked (the campaign's templates and their held items, as snapshotted)
     * and their answers: the last submitted one and the working copy.
     *
     * @throws TRPCError(NOT_FOUND) if the request isn't in the organization.
     */
    getRequestAnswers: selfAuditProcedure
        .input(z.object({ requestId: SelfAuditRequestId.schema }))
        .output(
            z.object({
                templates: z.array(SelfAuditTemplate),
                heldItems: z.array(SelfAuditHeldItem),
                submittedData: SelfAuditResponseData.nullable(),
                formData: SelfAuditResponseData,
                formStatus: z.string(),
            }),
        )
        .query(async ({ ctx, input: { requestId } }) => {
            return SelfAuditCampaigns.getRequestAnswers(ctx, requestId);
        }),

    /**
     * The members of the campaign's D4H team who can be added: those not in it, and withdrawn
     * ones (with the request re-adding them would reinstate).
     *
     * @throws TRPCError(PRECONDITION_FAILED) if the caller has no personal D4H token here.
     * @throws TRPCError(NOT_FOUND) if the campaign isn't in the organization, or the token doesn't
     * reach its D4H team.
     */
    listAddableMembers: selfAuditProcedure
        .input(z.object({ campaignId: SelfAuditCampaignId.schema }))
        .output(
            z.array(
                z.object({
                    d4hMemberId: z.number(),
                    name: z.string(),
                    email: z.string().nullable(),
                    withdrawnRequestId: SelfAuditRequestId.schema.nullable(),
                }),
            ),
        )
        .query(async ({ ctx, input: { campaignId } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
            return SelfAuditCampaigns.listAddableMembers(ctx, { accessToken, campaignId });
        }),

    /**
     * The organization's Active I3 bundles, to pick one to send.
     */
    listBundles: selfAuditProcedure
        .output(z.array(I3BundleSummary.schema))
        .query(async ({ ctx }) => {
            return SelfAuditCampaigns.listBundles(ctx);
        }),

    /**
     * The organization's self audit campaigns, newest first, with counts by status.
     */
    listCampaigns: selfAuditProcedure
        .output(z.array(SelfAuditCampaignSummary))
        .query(async ({ ctx }) => {
            return SelfAuditCampaigns.listCampaigns(ctx);
        }),

    /**
     * The organization's Active teams linked to a D4H team the caller's personal D4H token
     * reaches, to pin a campaign to.
     *
     * @throws TRPCError(PRECONDITION_FAILED) if the caller has no personal D4H token here.
     */
    listTeams: selfAuditProcedure
        .output(
            z.array(
                z.object({
                    id: TeamId.schema,
                    name: z.string(),
                    d4hTeamId: z.number(),
                    d4hTeamName: z.string(),
                }),
            ),
        )
        .query(async ({ ctx }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
            return SelfAuditCampaigns.listTeams(ctx, accessToken);
        }),

    /**
     * Remove a member from a Draft, deleting their request and form.
     *
     * @throws TRPCError(NOT_FOUND) if the request isn't in the organization.
     * @throws TRPCError(BAD_REQUEST) if the campaign has been sent (withdraw instead).
     * @throws TRPCError(CONFLICT) if it was sent meanwhile.
     */
    removeRequest: selfAuditProcedure
        .input(z.object({ requestId: SelfAuditRequestId.schema }))
        .output(SelfAuditCampaignRef)
        .mutation(async ({ ctx, input: { requestId } }) => {
            return SelfAuditCampaigns.removeRequest(ctx, requestId);
        }),

    /**
     * Email a member their link again, with a new token and a fresh expiry; the old link stops
     * working. Their draft, submitted answers and progress are kept. Allowed for a sent member
     * with an email, a stuck Pending included.
     *
     * @throws TRPCError(NOT_FOUND) if the request isn't in the organization.
     * @throws TRPCError(BAD_REQUEST) if the member has no email, isn't sent yet, or is withdrawn.
     */
    resendRequest: selfAuditProcedure
        .input(z.object({ requestId: SelfAuditRequestId.schema }))
        .output(
            z.object({
                campaignId: SelfAuditCampaignId.schema,
                deliveryStatus: z.enum(["Sent", "Failed"]),
            }),
        )
        .mutation(async ({ ctx, input: { requestId } }) => {
            return SelfAuditCampaigns.resendRequest(ctx, requestId);
        }),

    /**
     * Send a Draft self audit campaign: refresh each member's name and email from D4H (those
     * added with no email too), mark the campaign sent, then email each of them their own link,
     * one at a time. Returns how many were sent, failed, or had no email.
     *
     * @throws TRPCError(PRECONDITION_FAILED) if the caller has no personal D4H token here.
     * @throws TRPCError(NOT_FOUND) if the campaign isn't in the organization, or the token doesn't
     * reach its D4H team.
     * @throws TRPCError(CONFLICT) if the campaign has already been sent.
     * @throws TRPCError(BAD_REQUEST) if it has no members, or D4H has an email for none of them.
     */
    sendCampaign: selfAuditProcedure
        .input(z.object({ campaignId: SelfAuditCampaignId.schema }))
        .output(SelfAuditSendResult)
        .mutation(async ({ ctx, input: { campaignId } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
            return SelfAuditCampaigns.sendCampaign(ctx, { accessToken, campaignId });
        }),

    /**
     * Withdraw a member from a sent campaign: their link stops working at once; their request and
     * answers are kept, shown as Withdrawn.
     *
     * @throws TRPCError(NOT_FOUND) if the request isn't in the organization.
     * @throws TRPCError(BAD_REQUEST) if the campaign is a Draft (remove instead), or the member is
     * already withdrawn.
     */
    withdrawRequest: selfAuditProcedure
        .input(z.object({ requestId: SelfAuditRequestId.schema }))
        .output(SelfAuditCampaignRef)
        .mutation(async ({ ctx, input: { requestId } }) => {
            return SelfAuditCampaigns.withdrawRequest(ctx, requestId);
        }),
});
