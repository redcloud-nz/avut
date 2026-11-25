/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { ForbiddenError } from "@/lib/errors";
import { D4HTeamRef } from "@/lib/schemas/d4h/team";
import { I3BundleId, I3BundleSummary } from "@/lib/schemas/i3-bundle";
import { KitCheckD4HTeam } from "@/lib/schemas/kit-check";
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

/** The most D4H teams one kit check is sent to. */
const D4H_TEAMS_MAX = 20;

const KitCheckExcludedLine = z.object({
    templateId: z.string(),
    name: z.string(),
    reason: z.enum(["deleted", "no-d4h-type", "not-in-team"]),
});

export const kitChecksRouter = createTrpcRouter({
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
                d4hTeamIds: z.array(z.number().int()).min(1).max(D4H_TEAMS_MAX),
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
});
