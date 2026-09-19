/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { auth } from "@/server/auth";
import { OrganizationData, OrganizationId } from "@/lib/schemas/organization";
import { InvitationId, OrganizationInvitationData } from "@/lib/schemas/organization-invitation";
import { OrganizationUser } from "@/lib/schemas/organization-user";
import { PersonData, PersonId } from "@/lib/schemas/person";
import { UserData, UserId } from "@/lib/schemas/user";
import { UserSessionData, UserSessionId } from "@/lib/schemas/user-session";

import { FieldConflictError } from "../errors";
import {
    type AuthenticatedContext,
    authenticatedProcedure,
    createTrpcRouter,
    organizationProcedure,
} from "../init";
import { Messages } from "../messages";

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
 * Router for organization user (member) management, including the link between
 * a user account and a personnel record.
 */
export const usersRouter = createTrpcRouter({
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
            // $transaction with the log entry — log only once it has succeeded.
            const { member } = await auth.api.acceptInvitation({
                body: { invitationId: invitation.id },
                headers: await ctx.getHeaders(),
            });

            await ctx.logEvent({
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

    /**
     * Retrieves the personnel record linked to a user, if any.
     * @param ctx The authenticated context.
     * @param input The user ID to look up.
     * @returns The linked personnel record, or null if no link exists.
     * @throws TRPCError(NOT_FOUND) if the user does not exist or is not part of the organization.
     */
    getLinkedPerson: organizationProcedure({ member: ["view"], person: ["view"] })
        .input(z.object({ userId: UserId.schema }))
        .output(PersonData.schema.nullable())
        .query(async ({ ctx, input }) => {
            const user = await ctx.prisma.organizationUser.findFirst({
                where: {
                    organizationId: ctx.organizationId,
                    userId: input.userId,
                },
                include: { person: true },
            });

            if (!user)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.userNotFound(input.userId),
                });

            return user.person ? PersonData.fromRecord(user.person) : null;
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
     * Links a personnel record to a user account within the organization.
     *
     * @param ctx The authenticated organization context.
     * @param input The user ID and person ID to link.
     * @throws TRPCError(NOT_FOUND) if the user is not part of the organization.
     * @throws TRPCError(NOT_FOUND) if the person does not exist in the organization.
     * @throws TRPCError(CONFLICT) if the person is already linked to a different user.
     * @throws TRPCError(CONFLICT) if the user's membership is already linked to a different person.
     */
    linkPerson: organizationProcedure({ member: ["update"], person: ["update"] })
        .input(z.object({ userId: UserId.schema, personId: PersonId.schema }))
        .mutation(async ({ ctx, input }) => {
            const orgUser = await ctx.prisma.organizationUser.findUnique({
                where: {
                    organizationId_userId: {
                        organizationId: ctx.organizationId,
                        userId: input.userId,
                    },
                },
            });

            if (!orgUser)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.userNotFound(input.userId),
                });

            const person = await ctx.prisma.person.findUnique({
                where: { id: input.personId, organizationId: ctx.organizationId },
                include: { organizationUser: true },
            });

            if (!person)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.personNotFound(input.personId),
                });

            if (person.organizationUser && person.organizationUser.userId !== input.userId)
                throw new TRPCError({
                    code: "CONFLICT",
                    cause: new FieldConflictError(
                        "person",
                        "This person is already linked to another user.",
                    ),
                });

            /*
             * The mirror guard. Without it the update below overwrites `personId`, silently
             * unlinking whoever held it — no conflict, and no audit entry recording the unlink.
             * The person-side check above cannot catch this: it only asks whether the *incoming*
             * person is taken.
             */
            if (orgUser.personId && orgUser.personId !== input.personId)
                throw new TRPCError({
                    code: "CONFLICT",
                    cause: new FieldConflictError(
                        "user",
                        "This user is already linked to another person.",
                    ),
                });

            await ctx.prisma.$transaction([
                ctx.prisma.organizationUser.update({
                    where: {
                        organizationId_userId: {
                            organizationId: ctx.organizationId,
                            userId: input.userId,
                        },
                    },
                    data: { personId: input.personId },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "OrganizationMembership",
                    objectId: orgUser.id,
                    description: `Linked person (${person.id}, ${person.name}) to user (${input.userId}).`,
                }),
            ]);
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
     * Lists the user-to-person links in the organization.
     * Used to display the linked person alongside each user in the user list.
     *
     * @param ctx The authenticated organization context.
     * @returns An array of `{ userId, person }` pairs for every linked user.
     */
    listPersonLinks: organizationProcedure({ member: ["view"], person: ["view"] })
        .output(z.array(z.object({ userId: UserId.schema, person: PersonData.schema })))
        .query(async ({ ctx }) => {
            const links = await ctx.prisma.organizationUser.findMany({
                where: {
                    organizationId: ctx.organizationId,
                    personId: { not: null },
                },
                include: { person: true },
            });

            return links
                .filter((link) => link.person !== null)
                .map((link) => ({
                    userId: UserId.schema.parse(link.userId),
                    person: PersonData.fromRecord(link.person!),
                }));
        }),

    /**
     * Lists the authenticated user's active sessions, for the security settings card.
     *
     * Read straight from the session table rather than through Better Auth's
     * `/list-sessions`, which is guarded by a freshness check that blanks the card 24h
     * after sign-in. Revocation still goes through Better Auth (see `revokeSession`), so
     * the only thing bypassed here is a read gate on the user's own data.
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

            // Not a Prisma operation, so it can't join a $transaction with the log entry.
            await auth.api.rejectInvitation({
                body: { invitationId: invitation.id },
                headers: await ctx.getHeaders(),
            });

            await ctx.logEvent({
                action: "Update",
                objectType: "OrganizationInvitation",
                objectId: invitation.id,
                description: `Rejected invitation to join ${invitation.organization.name} (${invitation.organizationId}).`,
            });
        }),

    /**
     * Revokes one of the authenticated user's other sessions, signing that device out.
     *
     * Takes a session id rather than a token so tokens never have to reach the browser.
     * The lookup is scoped to the caller's own sessions, so another user's session is
     * indistinguishable from a nonexistent one.
     *
     * @param ctx The authenticated context.
     * @param input The id of the session to revoke.
     * @throws TRPCError(NOT_FOUND) if the session isn't one of the caller's.
     * @throws TRPCError(BAD_REQUEST) if it is the caller's current session.
     */
    revokeSession: authenticatedProcedure
        .input(z.object({ sessionId: UserSessionId.schema }))
        .mutation(async ({ ctx, input }) => {
            const session = await ctx.prisma.session.findFirst({
                where: { id: input.sessionId, userId: ctx.userId },
            });

            if (!session)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Session not found.",
                });

            // Signing yourself out is a different action with different cleanup — it has to
            // clear the cookie and tear down the client caches, which this can't do.
            if (session.id === ctx.auth.session.id)
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Use sign out to end the current session.",
                });

            // Delegated rather than deleting the row, so Better Auth invalidates whatever
            // session caching it has configured.
            await auth.api.revokeSession({
                body: { token: session.token },
                headers: await ctx.getHeaders(),
            });
        }),

    /**
     * Unlinks the personnel record currently associated with a user account.
     *
     * @param ctx The authenticated organization context.
     * @param input The user ID to unlink.
     * @returns The ID of the personnel record that was unlinked, or null if none was linked.
     * @throws TRPCError(NOT_FOUND) if the user is not part of the organization.
     */
    unlinkPerson: organizationProcedure({ member: ["update"], person: ["update"] })
        .input(z.object({ userId: UserId.schema }))
        .output(z.object({ personId: PersonId.schema.nullable() }))
        .mutation(async ({ ctx, input }) => {
            const orgUser = await ctx.prisma.organizationUser.findUnique({
                where: {
                    organizationId_userId: {
                        organizationId: ctx.organizationId,
                        userId: input.userId,
                    },
                },
            });

            if (!orgUser)
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.userNotFound(input.userId),
                });

            await ctx.prisma.$transaction([
                ctx.prisma.organizationUser.update({
                    where: {
                        organizationId_userId: {
                            organizationId: ctx.organizationId,
                            userId: input.userId,
                        },
                    },
                    data: { personId: null },
                }),
                ctx.logEvent({
                    action: "Update",
                    objectType: "OrganizationMembership",
                    objectId: orgUser.id,
                    description: `Unlinked person (${orgUser.personId}) from user (${input.userId}).`,
                }),
            ]);

            return { personId: orgUser.personId as PersonId | null };
        }),
});
