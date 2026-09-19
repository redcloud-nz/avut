/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { InvitationId, InvitationLandingData } from "@/lib/schemas/organization-invitation";
import { PasswordSchema } from "@/lib/schemas/password";
import { UserId } from "@/lib/schemas/user";
import { auth } from "@/server/auth";
import { formatActorLabel, recordLogEntry } from "@/server/log-entry";
import { withoutVerificationOtpEmail } from "@/server/verification-otp-suppression";

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

    /**
     * Creates an account for the address an invitation was sent to, already verified, and signs
     * the new user in.
     *
     * Reaching the landing page proves the person controls the mailbox the invitation went to, so
     * the usual emailed verification code would only repeat that proof. The email is taken from
     * the invitation, never from the caller, so the exemption cannot be pointed at an address the
     * invitation wasn't sent to. The invitation id is the credential; it must be pending and
     * unexpired, and an existing account for the address is refused (sign in instead) so this can
     * never touch or take over one.
     *
     * Does not accept the invitation — the caller is returned to the landing page to do that.
     *
     * @param ctx The unauthenticated context.
     * @param input The invitation id, and the new account's name and password.
     * @throws TRPCError(BAD_REQUEST) if the caller is already signed in.
     * @throws TRPCError(NOT_FOUND) if the invitation is not pending or has expired.
     * @throws TRPCError(CONFLICT) if an account already exists for the invited address.
     */
    signUp: publicProcedure
        .input(
            z.object({
                invitationId: InvitationId.schema,
                name: z.string().trim().min(2, "Name is required."),
                password: PasswordSchema,
            }),
        )
        .output(z.object({ userId: UserId.schema }))
        .mutation(async ({ ctx, input }) => {
            if (ctx.auth)
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "You are already signed in. Sign out to create a new account.",
                });

            const invitation = await ctx.prisma.organizationInvitation.findFirst({
                where: {
                    id: input.invitationId,
                    status: "pending",
                    expiresAt: { gt: new Date() },
                },
                include: { organization: { select: { name: true } } },
            });

            if (!invitation)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Invitation not found, expired, or already answered.",
                });

            const email = invitation.email.toLowerCase();

            // Checked here rather than left to Better Auth, which answers a duplicate sign-up
            // with a deliberately generic success.
            const existing = await ctx.prisma.user.findUnique({
                where: { email },
                select: { id: true },
            });
            if (existing)
                throw new TRPCError({
                    code: "CONFLICT",
                    message: "An account already exists for this email address. Sign in instead.",
                });

            const headers = await ctx.getHeaders();

            const { user } = await withoutVerificationOtpEmail(() =>
                auth.api.signUpEmail({
                    body: { name: input.name, email, password: input.password },
                    headers,
                }),
            );
            const userId = UserId.schema.parse(user.id);

            /*
             * `logEvent` isn't available on a public procedure — there is no session to attribute
             * it to yet — so this goes straight through `recordLogEntry`, the same single writer
             * `logEvent` delegates to. The new user is both owner and actor.
             */
            await ctx.prisma.$transaction([
                ctx.prisma.user.update({ where: { id: userId }, data: { emailVerified: true } }),
                recordLogEntry(
                    {
                        scope: "user",
                        ownerId: userId,
                        actor: { userId },
                        actorLabel: formatActorLabel(user.name, email),
                        action: "Create",
                        objectType: "User",
                        objectId: userId,
                        description: `Created an account from an invitation to join ${invitation.organization.name} (${invitation.organizationId}); the address was verified by the invitation link.`,
                    },
                    ctx.prisma,
                ),
            ]);

            // Better Auth won't sign in an unverified account, so this has to follow the update.
            await auth.api.signInEmail({ body: { email, password: input.password }, headers });

            return { userId };
        }),
});
