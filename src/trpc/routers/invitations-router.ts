/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { InvitationId, InvitationLandingData } from "@/lib/schemas/organization-invitation";

import { createTrpcRouter, publicProcedure } from "../init";

/**
 * Router for the public side of organization invitations — the landing page an invitation email
 * links to. Answering an invitation as a signed-in user lives in `usersRouter`.
 */
export const invitationsRouter = createTrpcRouter({
    /**
     * Describes an invitation for its landing page, from the point of view of whoever is viewing
     * it. Unauthenticated: the invitation id is an unguessable secret delivered by email, and
     * holding it is what entitles the viewer to see this much.
     *
     * An unknown id is a `not-found` result rather than an error, so the page can render a
     * friendly explanation instead of an error boundary.
     *
     * @param ctx The (possibly unauthenticated) context.
     * @param input The invitation id from the link.
     * @returns The invitation's state and the viewer's relationship to it.
     */
    getLanding: publicProcedure
        .input(z.object({ invitationId: InvitationId.schema }))
        .output(InvitationLandingData.schema)
        .query(async ({ ctx, input }) => {
            const invitation = await ctx.prisma.organizationInvitation.findUnique({
                where: { id: input.invitationId },
                include: {
                    organization: { select: { name: true, slug: true } },
                    inviter: { select: { name: true } },
                    person: { select: { name: true } },
                },
            });

            if (!invitation) return { state: "not-found" as const };

            const email = invitation.email.toLowerCase();

            const state = (() => {
                if (invitation.status === "accepted") return "accepted" as const;
                if (invitation.status === "rejected") return "rejected" as const;
                if (invitation.status !== "pending") return "canceled" as const;
                return invitation.expiresAt.getTime() <= Date.now()
                    ? ("expired" as const)
                    : ("pending" as const);
            })();

            const viewerEmail = ctx.auth?.user.email.toLowerCase();
            const viewer = !viewerEmail
                ? ({ kind: "anonymous" } as const)
                : viewerEmail === email
                  ? ({ kind: "recipient" } as const)
                  : ({ kind: "other", email: viewerEmail } as const);

            const account = await ctx.prisma.user.findUnique({
                where: { email },
                select: { id: true },
            });

            return {
                state,
                organization: invitation.organization,
                inviterName: invitation.inviter.name,
                email,
                personName: invitation.person?.name ?? null,
                hasAccount: account != null,
                viewer,
            };
        }),
});
