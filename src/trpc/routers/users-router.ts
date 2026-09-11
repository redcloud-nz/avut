/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { auth } from "@/server/auth";
import { OrganizationData } from "@/lib/schemas/organization";
import { OrganizationUser } from "@/lib/schemas/organization-user";
import { PersonData, PersonId } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
import { UserSessionData, UserSessionId } from "@/lib/schemas/user-session";

import { FieldConflictError } from "../errors";
import { authenticatedProcedure, createTrpcRouter, organizationProcedure } from "../init";
import { Messages } from "../messages";

/**
 * Router for organization user (member) management, including the link between
 * a user account and a personnel record.
 */
export const usersRouter = createTrpcRouter({
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

    /**
     * Links a personnel record to a user account within the organization.
     *
     * @param ctx The authenticated organization context.
     * @param input The user ID and person ID to link.
     * @throws TRPCError(NOT_FOUND) if the user is not part of the organization.
     * @throws TRPCError(NOT_FOUND) if the person does not exist in the organization.
     * @throws TRPCError(CONFLICT) if the person is already linked to a different user.
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
                include: { organization: true, user: true },
            });

            return memberships.map((membership) => ({
                ...OrganizationUser.fromRecord(membership.user, membership),
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
                headers: ctx.headers,
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
