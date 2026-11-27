/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { ForbiddenError } from "@/lib/errors";
import type { ExcludedReason } from "@/lib/i3-bundle-compare";
import { D4HTeamRef } from "@/lib/schemas/d4h/team";
import { I3BundleId, I3BundleSummary } from "@/lib/schemas/i3-bundle";
import {
    SELF_AUDIT_D4H_TEAMS_MAX,
    SelfAuditCampaignId,
    SelfAuditD4HTeam,
    SelfAuditDeliveryStatus,
    SelfAuditHeldItem,
    SelfAuditProgress,
    SelfAuditRequestId,
    SelfAuditResponseData,
    SelfAuditTeamChoice,
    SelfAuditTemplate,
} from "@/lib/schemas/self-audit";
import { getConfiguredD4HAccessToken } from "@/server/d4h-access-token";
import * as SelfAuditCampaigns from "@/server/services/self-audit-campaigns";

import { createTrpcRouter, organizationProcedure } from "../init";

/**
 * Every self-audit procedure is for system admins only (decision 15 of the self-audit plan): an org
 * member without the Better Auth `admin` role is refused, whatever their org roles.
 */
const selfAuditProcedure = organizationProcedure({}, { allowSystemAdmin: true }).use(
    ({ ctx, next }) => {
        if (!ctx.isSystemAdmin)
            throw new ForbiddenError("Self audit campaigns are for system admins only.");
        return next();
    },
);

const SelfAuditExcludedLine = z.object({
    templateId: z.string(),
    name: z.string(),
    reason: z.enum(["deleted", "no-d4h-type", "not-in-team"]) satisfies z.ZodType<ExcludedReason>,
});

const SelfAuditCampaignSummary = z.object({
    id: SelfAuditCampaignId.schema,
    bundleName: z.string(),
    d4hTeams: z.array(SelfAuditD4HTeam),
    sentByName: z.string().nullable(),
    createdAt: z.date(),
    counts: z.object({
        delivery: z.record(SelfAuditDeliveryStatus, z.number()),
        progress: z.record(SelfAuditProgress, z.number()),
    }),
});

/** A request as the admin pages see it. Deliberately has no token hash. */
const SelfAuditRequestSummary = z.object({
    id: SelfAuditRequestId.schema,
    d4hTeamId: z.number(),
    d4hTeamTitle: z.string(),
    d4hMemberId: z.number(),
    memberName: z.string(),
    email: z.string().nullable(),
    deliveryStatus: SelfAuditDeliveryStatus,
    sentAt: z.date().nullable(),
    openedAt: z.date().nullable(),
    submittedAt: z.date().nullable(),
    expiresAt: z.date().nullable(),
    formStatus: z.string(),
    progress: SelfAuditProgress,
});

export const selfAuditCampaignsRouter = createTrpcRouter({
    /**
     * Create a self audit campaign of the bundle for the chosen D4H members of the chosen teams,
     * snapshotting what each is asked, and email each member with an address their own link, one
     * at a time. Returns how many were sent, failed, or had no email.
     *
     * @throws TRPCError(PRECONDITION_FAILED) if the caller has no personal D4H token here.
     * @throws TRPCError(NOT_FOUND) if the bundle isn't in the organization, or the token doesn't
     * reach a team.
     * @throws TRPCError(BAD_REQUEST) if the bundle is Deleted, no member is chosen, or a chosen
     * member isn't in the team they're chosen under.
     */
    createCampaign: selfAuditProcedure
        .input(
            z.object({
                bundleId: I3BundleId.schema,
                teams: z.array(SelfAuditTeamChoice).min(1).max(SELF_AUDIT_D4H_TEAMS_MAX),
            }),
        )
        .output(
            z.object({
                campaignId: SelfAuditCampaignId.schema,
                sent: z.number(),
                failed: z.number(),
                noEmail: z.number(),
            }),
        )
        .mutation(async ({ ctx, input: { bundleId, teams } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
            return SelfAuditCampaigns.createCampaign(ctx, { accessToken, bundleId, teams });
        }),

    /**
     * A self audit campaign with every member's request: delivery, progress and times.
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
     * What one member was asked (their team's templates and their held items, as snapshotted at
     * send) and their answers: the last submitted one and the working copy.
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
     * The organization's Active I3 bundles, to pick one to send.
     */
    listBundles: selfAuditProcedure
        .output(z.array(I3BundleSummary.schema))
        .query(async ({ ctx }) => {
            return SelfAuditCampaigns.listBundles(ctx);
        }),

    /**
     * The D4H teams the caller's personal D4H token reaches, to pick from.
     *
     * @throws TRPCError(PRECONDITION_FAILED) if the caller has no personal D4H token here.
     */
    listD4HTeams: selfAuditProcedure.output(z.array(D4HTeamRef.schema)).query(async ({ ctx }) => {
        const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
        return SelfAuditCampaigns.listD4HTeams(ctx, accessToken);
    }),

    /**
     * The organization's self audit campaigns, newest first, with counts by delivery and progress.
     */
    listCampaigns: selfAuditProcedure
        .output(z.array(SelfAuditCampaignSummary))
        .query(async ({ ctx }) => {
            return SelfAuditCampaigns.listCampaigns(ctx);
        }),

    /**
     * Who a self audit campaign of the bundle would go to, per team: each member with their email and how
     * many of the bundle's lines they hold, and the lines left out of the comparison and why.
     *
     * @throws TRPCError(PRECONDITION_FAILED) if the caller has no personal D4H token here.
     * @throws TRPCError(NOT_FOUND) if the bundle isn't in the organization, or the token doesn't
     * reach a team.
     * @throws TRPCError(BAD_REQUEST) if the bundle is Deleted.
     */
    previewRecipients: selfAuditProcedure
        .input(
            z.object({
                bundleId: I3BundleId.schema,
                d4hTeamIds: z.array(z.number().int()).min(1).max(SELF_AUDIT_D4H_TEAMS_MAX),
            }),
        )
        .output(
            z.array(
                z.object({
                    team: SelfAuditD4HTeam,
                    templateCount: z.number(),
                    members: z.array(
                        z.object({
                            id: z.number(),
                            name: z.string(),
                            email: z.string().nullable(),
                            heldCount: z.number(),
                        }),
                    ),
                    excluded: z.array(SelfAuditExcludedLine),
                }),
            ),
        )
        .query(async ({ ctx, input: { bundleId, d4hTeamIds } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
            return SelfAuditCampaigns.previewRecipients(ctx, { accessToken, bundleId, d4hTeamIds });
        }),

    /**
     * Email a member their link again, with a new token and a fresh expiry; the old link stops
     * working. Their draft, submitted answers and progress are kept. Allowed for any delivery but
     * NoEmail, a stuck Pending included.
     *
     * @throws TRPCError(NOT_FOUND) if the request isn't in the organization.
     * @throws TRPCError(BAD_REQUEST) if the member has no email.
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
});
