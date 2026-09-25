/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { type LogAction, type LogObjectType } from "@/lib/schemas/log-entry";
import { OrganizationData, OrganizationId } from "@/lib/schemas/organization";
import { InvitationId, OrganizationInvitationData } from "@/lib/schemas/organization-invitation";
import { OrganizationUser } from "@/lib/schemas/organization-user";
import { UserData, UserId } from "@/lib/schemas/user";
import { UserSessionData } from "@/lib/schemas/user-session";
import { auth } from "@/server/auth";
import { createLogBatch, formatActorLabel, recordLogEntry, resolveActor } from "@/server/log-entry";

import {
    authenticatedProcedure,
    createTrpcRouter,
    publicProcedure,
    type AuthenticatedContext,
} from "../init";

/**
 * Output of `getSession` — the subset of Better Auth's session/user record the client actually
 * needs. Kept separate from `UserData` (used by `getSelf`) because `role` and
 * `impersonatedBy` are session-level concerns `getSelf`'s callers have no business seeing.
 */
const SessionData = z.object({
    user: UserData.schema.extend({ role: z.string().nullable() }),
    session: z.object({ impersonatedBy: z.string().nullable() }),
});

/**
 * Loads a pending, unexpired invitation addressed to the caller. Better Auth re-checks the
 * recipient itself, but doing it here gives a clean NOT_FOUND and the organization for the log.
 */
async function findOwnPendingInvitation(
    ctx: Pick<AuthenticatedContext, "prisma" | "auth">,
    invitationId: InvitationId,
) {
    const invitation = await ctx.prisma.organizationInvitation.findFirst({
        where: {
            id: invitationId,
            email: ctx.auth.user.email,
            status: "pending",
            expiresAt: { gt: new Date() },
        },
        include: { organization: { select: { name: true, slug: true } } },
    });

    if (!invitation)
        throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invitation not found, expired, or already answered.",
        });

    return invitation;
}

/**
 * Records that the caller answered an invitation, on both timelines it belongs to: their own
 * (`ctx.logEvent` is user-scoped for an `authenticatedProcedure`) and the organization's, which
 * would otherwise never learn that a member joined or an invitation was turned down.
 *
 * Two independently meaningful events, so they share a `LogBatch`. Written in one interactive
 * transaction — the batch has to exist before the entries that reference it, and its id is only
 * known once it is created.
 */
async function logInvitationAnswer(
    ctx: AuthenticatedContext,
    input: {
        operationKey: "invitation-accept" | "invitation-reject";
        organizationId: string;
        action: LogAction;
        objectType: LogObjectType;
        objectId: string;
        description: string;
    },
) {
    const { operationKey, organizationId, ...entry } = input;

    await ctx.prisma.$transaction(async (tx) => {
        const batch = await createLogBatch(
            {
                operationKey,
                userId: ctx.userId,
                actorLabel: formatActorLabel(ctx.auth.user.name, ctx.auth.user.email),
                description: entry.description,
            },
            tx,
        );

        await ctx.logEvent({ ...entry, batchId: batch.id }, tx);
        await recordLogEntry(
            {
                scope: "organization",
                organizationId: OrganizationId.schema.parse(organizationId),
                ...resolveActor(ctx.auth),
                ...entry,
                batchId: batch.id,
            },
            tx,
        );
    });
}

/**
 * Router for procedures that pertain to the current (authenticated) user — their own account,
 * session, memberships, and invitations. Contrast with `usersRouter`, which manages other users
 * within an organization.
 */
export const userRouter = createTrpcRouter({
    /**
     * Accepts one of the caller's pending organization invitations, making them a member.
     *
     * @param ctx The authenticated context.
     * @param input The invitation to accept.
     * @returns The joined organization's slug, so the caller can navigate into it.
     * @throws TRPCError(NOT_FOUND) if the invitation is not pending, has expired, or is addressed
     *   to someone else.
     */
    acceptInvitation: authenticatedProcedure
        .input(z.object({ invitationId: InvitationId.schema }))
        .output(z.object({ organizationSlug: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const invitation = await findOwnPendingInvitation(ctx, input.invitationId);

            // Better Auth creates the membership and runs `afterAcceptInvitation` (person link,
            // role cache revalidation). It isn't a Prisma operation, so it can't join a
            // $transaction with the log entries — log only once it has succeeded.
            const { member } = await auth.api.acceptInvitation({
                body: { invitationId: invitation.id },
                headers: await ctx.getHeaders(),
            });

            await logInvitationAnswer(ctx, {
                operationKey: "invitation-accept",
                organizationId: invitation.organizationId,
                action: "Create",
                objectType: "OrganizationMembership",
                objectId: member.id,
                description: `Accepted invitation to join ${invitation.organization.name} (${invitation.organizationId}).`,
            });

            return { organizationSlug: invitation.organization.slug };
        }),

    /**
     * Counts log entries by organization, object type, and action over the last 24 hours,
     * across every organization the caller belongs to. For a dashboard-level activity
     * summary — not a substitute for an org's own (permission-checked) activity feed, since
     * this only ever returns counts, never entry details.
     *
     * @param ctx The authenticated context.
     * @returns One row per (organization, object type, action) combination with a nonzero count.
     */
    getActivityStats: authenticatedProcedure
        .output(
            z.array(
                z.object({
                    organizationId: OrganizationId.schema,
                    objectType: z.string(),
                    action: z.string(),
                    count: z.number(),
                }),
            ),
        )
        .query(async ({ ctx }) => {
            const memberships = await ctx.prisma.organizationUser.findMany({
                where: { userId: ctx.userId },
                select: { organizationId: true },
            });

            if (memberships.length === 0) return [];

            const organizationIds = memberships.map((m) => m.organizationId);
            const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

            // Skill checks aren't written through `ctx.logEvent` (no `LogEntry` row per
            // check), so they're invisible to the log-entry-backed counts below — count
            // them directly off `SkillCheck` instead.
            const skillCheckCounts = await ctx.prisma.skillCheck.groupBy({
                by: ["organizationId"],
                where: {
                    organizationId: { in: organizationIds },
                    createdAt: { gte: since },
                },
                _count: true,
            });

            const skillCheckRows = skillCheckCounts
                .filter((row) => row._count > 0)
                .map((row) => ({
                    organizationId: OrganizationId.schema.parse(row.organizationId),
                    objectType: "SkillCheck",
                    action: "Create",
                    count: row._count,
                }));

            const logEntryCounts = await ctx.prisma.logEntry.groupBy({
                by: ["organizationId", "objectType", "action"],
                where: {
                    organizationId: { in: organizationIds },
                    timestamp: { gte: since },
                },
                _count: true,
            });

            const logEntryRows = logEntryCounts.map((row) => ({
                // `organizationId` is guaranteed non-null: the `where` clause only matches
                // rows already filtered to the caller's (non-null) organization memberships.
                organizationId: OrganizationId.schema.parse(row.organizationId),
                objectType: row.objectType,
                action: row.action,
                count: row._count,
            }));

            return [...skillCheckRows, ...logEntryRows];
        }),

    getSelf: authenticatedProcedure.output(UserData.schema).query(async ({ ctx }) => {
        const user = ctx.auth.user;

        return {
            id: UserId.schema.parse(user.id),
            name: user.name,
            email: user.email,
            image: user.image || null,
        };
    }),

    /**
     * The current session, or `null` if the caller isn't signed in.
     *
     * Deliberately a `publicProcedure` rather than `authenticatedProcedure`: an absent
     * session is a valid result (`null`), not an error. `SessionWatcher` depends on that —
     * it redirects on `data === null`, and an `UNAUTHORIZED` throw here would surface as a
     * query `error` instead, which it deliberately treats as a transient failure, not a
     * sign-out.
     *
     * @param ctx The (possibly unauthenticated) context.
     * @returns The caller's user fields plus session-level ones (`role`, `impersonatedBy`)
     *   `getSelf` doesn't expose, or `null`.
     */
    getSession: publicProcedure.output(SessionData.nullable()).query(({ ctx }) => {
        if (!ctx.auth) return null;

        const { user, session } = ctx.auth;

        return {
            user: {
                id: UserId.schema.parse(user.id),
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified,
                image: user.image || null,
                role: user.role ?? null,
            },
            session: { impersonatedBy: session.impersonatedBy ?? null },
        };
    }),

    /**
     * Lists the authenticated user's pending organization invitations, for the dashboard's
     * invitations card.
     *
     * @param ctx The authenticated context.
     * @returns Pending invitations addressed to the caller's (session) email.
     */
    listInvitations: authenticatedProcedure
        .output(
            z.array(
                OrganizationInvitationData.schema.extend({
                    organization: OrganizationData.schema.pick({
                        id: true,
                        name: true,
                        slug: true,
                        logo: true,
                    }),
                }),
            ),
        )
        .query(async ({ ctx }) => {
            const invitations = await ctx.prisma.organizationInvitation.findMany({
                where: {
                    email: ctx.auth.user.email,
                    status: "pending",
                    expiresAt: { gt: new Date() },
                },
                include: { organization: true },
            });

            return invitations.map((invitation) => ({
                ...OrganizationInvitationData.fromRecord(invitation),
                organization: OrganizationData.fromRecord(invitation.organization),
            }));
        }),

    /**
     * Lists the organizations that the authenticated user is a member of, along with their roles in each organization.
     */
    listMemberships: authenticatedProcedure
        .output(
            z.array(
                OrganizationUser.schema.extend({
                    organization: OrganizationData.schema.pick({
                        id: true,
                        name: true,
                        slug: true,
                        logo: true,
                    }),
                }),
            ),
        )
        .query(async ({ ctx }) => {
            const memberships = await ctx.prisma.organizationUser.findMany({
                where: {
                    userId: ctx.auth.user.id,
                },
                include: { organization: true },
            });

            return memberships.map((membership) => ({
                ...OrganizationUser.fromRecord(membership),
                organization: OrganizationData.fromRecord(membership.organization),
            }));
        }),

    /**
     * Lists the authenticated user's active sessions, for the security settings card.
     *
     * Read straight from the session table rather than through Better Auth's
     * `/list-sessions`, which is guarded by a freshness check that blanks the card 24h
     * after sign-in. Revocation still goes through Better Auth (see `usersRouter.revokeSession`),
     * so the only thing bypassed here is a read gate on the user's own data.
     *
     * @param ctx The authenticated context.
     * @returns The user's unexpired sessions, newest first, each flagged if it is the caller.
     */
    listSessions: authenticatedProcedure
        .output(z.array(UserSessionData.schema))
        .query(async ({ ctx }) => {
            const sessions = await ctx.prisma.session.findMany({
                where: {
                    userId: ctx.userId,
                    expiresAt: { gt: new Date() },
                },
                orderBy: { createdAt: "desc" },
            });

            return sessions.map((session) =>
                UserSessionData.fromRecord(session, session.id === ctx.auth.session.id),
            );
        }),

    /**
     * Rejects one of the caller's pending organization invitations.
     *
     * @param ctx The authenticated context.
     * @param input The invitation to reject.
     * @throws TRPCError(NOT_FOUND) if the invitation is not pending, has expired, or is addressed
     *   to someone else.
     */
    rejectInvitation: authenticatedProcedure
        .input(z.object({ invitationId: InvitationId.schema }))
        .mutation(async ({ ctx, input }) => {
            const invitation = await findOwnPendingInvitation(ctx, input.invitationId);

            // Not a Prisma operation, so it can't join a $transaction with the log entries.
            await auth.api.rejectInvitation({
                body: { invitationId: invitation.id },
                headers: await ctx.getHeaders(),
            });

            await logInvitationAnswer(ctx, {
                operationKey: "invitation-reject",
                organizationId: invitation.organizationId,
                action: "Update",
                objectType: "OrganizationInvitation",
                objectId: invitation.id,
                description: `Rejected invitation to join ${invitation.organization.name} (${invitation.organizationId}).`,
            });
        }),
});
