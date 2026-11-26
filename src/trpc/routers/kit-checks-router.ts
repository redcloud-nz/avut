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
    KIT_CHECK_D4H_TEAMS_MAX,
    KitCheckD4HTeam,
    KitCheckDeliveryStatus,
    KitCheckHeldItem,
    KitCheckId,
    KitCheckProgress,
    KitCheckRequestId,
    KitCheckResponseData,
    KitCheckTeamChoice,
    KitCheckTemplate,
} from "@/lib/schemas/kit-check";
import { getConfiguredD4HAccessToken } from "@/server/d4h-access-token";
import * as KitChecks from "@/server/services/kit-checks";

import { createTrpcRouter, organizationProcedure } from "../init";

/**
 * Every kit-check procedure is for system admins only (decision 15 of the kit-check plan): an org
 * member without the Better Auth `admin` role is refused, whatever their org roles.
 */
const kitCheckProcedure = organizationProcedure({}, { allowSystemAdmin: true }).use(
    ({ ctx, next }) => {
        if (!ctx.isSystemAdmin) throw new ForbiddenError("Kit checks are for system admins only.");
        return next();
    },
);

const KitCheckExcludedLine = z.object({
    templateId: z.string(),
    name: z.string(),
    reason: z.enum(["deleted", "no-d4h-type", "not-in-team"]) satisfies z.ZodType<ExcludedReason>,
});

const KitCheckSummary = z.object({
    id: KitCheckId.schema,
    bundleName: z.string(),
    d4hTeams: z.array(KitCheckD4HTeam),
    sentByName: z.string().nullable(),
    createdAt: z.date(),
    counts: z.object({
        delivery: z.record(KitCheckDeliveryStatus, z.number()),
        progress: z.record(KitCheckProgress, z.number()),
    }),
});

/** A request as the admin pages see it. Deliberately has no token hash. */
const KitCheckRequestSummary = z.object({
    id: KitCheckRequestId.schema,
    d4hTeamId: z.number(),
    d4hTeamTitle: z.string(),
    d4hMemberId: z.number(),
    memberName: z.string(),
    email: z.string().nullable(),
    deliveryStatus: KitCheckDeliveryStatus,
    sentAt: z.date().nullable(),
    openedAt: z.date().nullable(),
    submittedAt: z.date().nullable(),
    expiresAt: z.date().nullable(),
    formStatus: z.string(),
    progress: KitCheckProgress,
});

export const kitChecksRouter = createTrpcRouter({
    /**
     * Create a kit check of the bundle for the chosen D4H members of the chosen teams,
     * snapshotting what each is asked, and email each member with an address their own link, one
     * at a time. Returns how many were sent, failed, or had no email.
     *
     * @throws TRPCError(PRECONDITION_FAILED) if the caller has no personal D4H token here.
     * @throws TRPCError(NOT_FOUND) if the bundle isn't in the organization, or the token doesn't
     * reach a team.
     * @throws TRPCError(BAD_REQUEST) if the bundle is Deleted, no member is chosen, or a chosen
     * member isn't in the team they're chosen under.
     */
    createKitCheck: kitCheckProcedure
        .input(
            z.object({
                bundleId: I3BundleId.schema,
                teams: z.array(KitCheckTeamChoice).min(1).max(KIT_CHECK_D4H_TEAMS_MAX),
            }),
        )
        .output(
            z.object({
                kitCheckId: KitCheckId.schema,
                sent: z.number(),
                failed: z.number(),
                noEmail: z.number(),
            }),
        )
        .mutation(async ({ ctx, input: { bundleId, teams } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
            return KitChecks.createKitCheck(ctx, { accessToken, bundleId, teams });
        }),

    /**
     * A kit check with every member's request: delivery, progress and times.
     *
     * @throws TRPCError(NOT_FOUND) if the kit check isn't in the organization.
     */
    getKitCheck: kitCheckProcedure
        .input(z.object({ kitCheckId: KitCheckId.schema }))
        .output(KitCheckSummary.extend({ requests: z.array(KitCheckRequestSummary) }))
        .query(async ({ ctx, input: { kitCheckId } }) => {
            return KitChecks.requireKitCheckById(ctx, kitCheckId);
        }),

    /**
     * What one member was asked (their team's templates and their held items, as snapshotted at
     * send) and their answers: the last submitted one and the working copy.
     *
     * @throws TRPCError(NOT_FOUND) if the request isn't in the organization.
     */
    getKitCheckAnswers: kitCheckProcedure
        .input(z.object({ requestId: KitCheckRequestId.schema }))
        .output(
            z.object({
                templates: z.array(KitCheckTemplate),
                heldItems: z.array(KitCheckHeldItem),
                submittedData: KitCheckResponseData.nullable(),
                formData: KitCheckResponseData,
                formStatus: z.string(),
            }),
        )
        .query(async ({ ctx, input: { requestId } }) => {
            return KitChecks.getKitCheckAnswers(ctx, requestId);
        }),

    /**
     * The organization's Active I3 bundles, to pick one to send.
     */
    listBundles: kitCheckProcedure
        .output(z.array(I3BundleSummary.schema))
        .query(async ({ ctx }) => {
            return KitChecks.listBundles(ctx);
        }),

    /**
     * The D4H teams the caller's personal D4H token reaches, to pick from.
     *
     * @throws TRPCError(PRECONDITION_FAILED) if the caller has no personal D4H token here.
     */
    listD4HTeams: kitCheckProcedure.output(z.array(D4HTeamRef.schema)).query(async ({ ctx }) => {
        const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
        return KitChecks.listD4HTeams(ctx, accessToken);
    }),

    /**
     * The organization's kit checks, newest first, with counts by delivery and progress.
     */
    listKitChecks: kitCheckProcedure.output(z.array(KitCheckSummary)).query(async ({ ctx }) => {
        return KitChecks.listKitChecks(ctx);
    }),

    /**
     * Who a kit check of the bundle would go to, per team: each member with their email and how
     * many of the bundle's lines they hold, and the lines left out of the comparison and why.
     *
     * @throws TRPCError(PRECONDITION_FAILED) if the caller has no personal D4H token here.
     * @throws TRPCError(NOT_FOUND) if the bundle isn't in the organization, or the token doesn't
     * reach a team.
     * @throws TRPCError(BAD_REQUEST) if the bundle is Deleted.
     */
    previewRecipients: kitCheckProcedure
        .input(
            z.object({
                bundleId: I3BundleId.schema,
                d4hTeamIds: z.array(z.number().int()).min(1).max(KIT_CHECK_D4H_TEAMS_MAX),
            }),
        )
        .output(
            z.array(
                z.object({
                    team: KitCheckD4HTeam,
                    templateCount: z.number(),
                    members: z.array(
                        z.object({
                            id: z.number(),
                            name: z.string(),
                            email: z.string().nullable(),
                            heldCount: z.number(),
                        }),
                    ),
                    excluded: z.array(KitCheckExcludedLine),
                }),
            ),
        )
        .query(async ({ ctx, input: { bundleId, d4hTeamIds } }) => {
            const accessToken = await getConfiguredD4HAccessToken(ctx.organizationId, ctx.userId);
            return KitChecks.previewRecipients(ctx, { accessToken, bundleId, d4hTeamIds });
        }),

    /**
     * Email a member their link again, with a new token and a fresh expiry; the old link stops
     * working. Their draft, submitted answers and progress are kept. Allowed for any delivery but
     * NoEmail, a stuck Pending included.
     *
     * @throws TRPCError(NOT_FOUND) if the request isn't in the organization.
     * @throws TRPCError(BAD_REQUEST) if the member has no email.
     */
    resendRequest: kitCheckProcedure
        .input(z.object({ requestId: KitCheckRequestId.schema }))
        .output(
            z.object({
                kitCheckId: KitCheckId.schema,
                deliveryStatus: z.enum(["Sent", "Failed"]),
            }),
        )
        .mutation(async ({ ctx, input: { requestId } }) => {
            return KitChecks.resendRequest(ctx, requestId);
        }),
});
