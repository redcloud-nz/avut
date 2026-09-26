/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { PersonData, PersonId } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
import { UserSessionId } from "@/lib/schemas/user-session";
import { auth } from "@/server/auth";

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
                throw new FieldConflictError(
                    "person",
                    "This person is already linked to another user.",
                );

            /*
             * The mirror guard. Without it the update below overwrites `personId`, silently
             * unlinking whoever held it — no conflict, and no audit entry recording the unlink.
             * The person-side check above cannot catch this: it only asks whether the *incoming*
             * person is taken.
             */
            if (orgUser.personId && orgUser.personId !== input.personId)
                throw new FieldConflictError(
                    "user",
                    "This user is already linked to another person.",
                );

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
     * Lists the organization's members that are not yet linked to a personnel record.
     * Used to populate the "link user" picker on the person detail page — the mirror of
     * `personnel.listUnlinkedPersonnel`.
     *
     * @param ctx The authenticated organization context.
     * @returns The org's unlinked members, sorted by name.
     */
    listUnlinkedMembers: organizationProcedure({ member: ["view"], person: ["view"] })
        .output(z.array(z.object({ userId: UserId.schema, name: z.string(), email: z.email() })))
        .query(async ({ ctx }) => {
            const members = await ctx.prisma.organizationUser.findMany({
                where: {
                    organizationId: ctx.organizationId,
                    personId: null,
                },
                include: { user: true },
            });

            return members
                .map((member) => ({
                    userId: UserId.schema.parse(member.userId),
                    name: member.user.name,
                    email: member.user.email,
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
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
