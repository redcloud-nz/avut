/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import { diffObject } from "@/lib/diff";
import { PersonData, PersonId } from "@/lib/schemas/person";
import { UserId } from "@/lib/schemas/user";
import { UserSessionId } from "@/lib/schemas/user-session";
import { auth } from "@/server/auth";
import { revalidateOrganizationUser } from "@/server/cache/organization-user-revalidate";
import * as UserAccounts from "@/server/services/user-accounts";

import { FieldConflictError } from "../errors";
import {
    authenticatedProcedure,
    createTrpcRouter,
    organizationProcedure,
    systemAdminProcedure,
    type SystemAdminContext,
} from "../init";
import { Messages } from "../messages";

/** A system admin's context, as the account service takes it: every entry system-scoped. */
function systemServiceContext(ctx: SystemAdminContext): UserAccounts.SystemServiceContext {
    return {
        prisma: ctx.prisma,
        logSystemEvent: (options, tx) => ctx.logEvent({ scope: "system", ...options }, tx),
    };
}

/**
 * Router for organization user (member) management, including the link between a user account
 * and a personnel record, plus site-wide user-account moderation (`systemAdminProcedure`-gated).
 */
export const usersRouter = createTrpcRouter({
    /**
     * Ban a user account, revoking their active sessions and blocking sign-in until unbanned.
     * `BAD_REQUEST` if the target is the caller — mirrors `deleteUser`'s/`setUserRole`'s
     * self-target guard; the client-side menu already hides this action for the caller's own
     * row, but a crafted call must be refused server-side too (#86).
     *
     * `auth.api.banUser` isn't a Prisma operation, so it can't join a `$transaction` with the
     * log entry — ban first, then log. The entry is `ownerId`-scoped (the banned user's own
     * timeline), not `scope: "system"`: unlike `deleteUser`, a ban doesn't remove the `User`
     * row, so there's nothing for the entry to outlive.
     */
    banUser: systemAdminProcedure
        .input(z.object({ userId: UserId.schema, banReason: z.string().min(1).optional() }))
        .mutation(async ({ ctx, input }) => {
            if (input.userId === ctx.auth.user.id) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "You cannot ban your own account.",
                });
            }

            const target = await ctx.prisma.user.findUnique({
                where: { id: input.userId },
                select: { id: true },
            });
            if (!target) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `User ${input.userId} not found.`,
                });
            }

            await auth.api.banUser({
                headers: await ctx.getHeaders(),
                body: {
                    userId: input.userId,
                    ...(input.banReason ? { banReason: input.banReason } : {}),
                },
            });

            await ctx.logEvent({
                ownerId: input.userId,
                action: "Ban",
                objectType: "User",
                objectId: input.userId,
                changes: input.banReason
                    ? [{ type: "obj_add", path: ["banReason"], curr: input.banReason }]
                    : [],
            });

            return { id: input.userId };
        }),

    /**
     * Soft-delete a user account into the system Rubbish bin (#296): it can't sign in, every
     * session is revoked, and the daily auto-purge removes it for good after
     * `USER_RETENTION_DAYS`. Recover with `recoverUser`; purge early with `purgeUser`.
     *
     * Guards: you cannot delete your own account (close it from your settings instead); the
     * service refuses the last system administrator and the sole owner of any organization.
     */
    deleteUser: systemAdminProcedure
        .input(z.object({ userId: UserId.schema }))
        .mutation(async ({ ctx, input }) => {
            if (input.userId === ctx.auth.user.id) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "You cannot delete your own account.",
                });
            }

            await UserAccounts.softDelete(systemServiceContext(ctx), input.userId, "admin");
            await revalidateOrganizationUser(input.userId);

            return { id: input.userId };
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

    getUser: systemAdminProcedure
        .input(z.object({ userId: UserId.schema }))
        .query(async ({ ctx, input }) => {
            const user = await ctx.prisma.user.findUnique({
                where: { id: input.userId },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    banned: true,
                    emailVerified: true,
                    createdAt: true,
                    organizationUsers: {
                        select: {
                            role: true,
                            organization: { select: { id: true, name: true, slug: true } },
                        },
                    },
                },
            });

            if (!user) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `User ${input.userId} not found.`,
                });
            }

            const { organizationUsers, ...rest } = user;

            return {
                ...rest,
                role: user.role ?? "user",
                banned: user.banned ?? false,
                organizations: organizationUsers.map((m) => ({ ...m.organization, role: m.role })),
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
                include: { user: { select: { status: true } } },
            });

            if (!orgUser || orgUser.user.status === "Deleted")
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: Messages.userNotFound(input.userId),
                });

            const person = await ctx.prisma.person.findUnique({
                where: { id: input.personId, organizationId: ctx.organizationId },
                include: { organizationUser: true },
            });

            if (!person || person.status === "Deleted")
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

    /** Every account in the system Rubbish bin, with its deletion and purge dates. */
    listDeletedUsers: systemAdminProcedure
        .output(
            z.array(
                z.object({
                    id: UserId.schema,
                    name: z.string(),
                    email: z.string(),
                    deletedAt: z.iso.datetime().nullable(),
                    purgeAt: z.iso.datetime().nullable(),
                }),
            ),
        )
        .query(async ({ ctx }) => {
            const users = await UserAccounts.listDeleted(ctx.prisma);
            return users.map((u) => ({
                ...u,
                id: UserId.schema.parse(u.id),
                deletedAt: u.deletedAt?.toISOString() ?? null,
                purgeAt: u.purgeAt?.toISOString() ?? null,
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
                    user: { status: { not: "Deleted" } },
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
                    user: { status: { not: "Deleted" } },
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

    listUsers: systemAdminProcedure.query(async ({ ctx }) => {
        // Deleted accounts live in the system Rubbish bin (`listDeletedUsers`) instead.
        const rows = await ctx.prisma.user.findMany({
            where: { status: { not: "Deleted" } },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                banned: true,
                emailVerified: true,
                createdAt: true,
                _count: { select: { organizationUsers: true } },
            },
            orderBy: { createdAt: "asc" },
        });

        return {
            users: rows.map(({ _count, ...u }) => ({
                ...u,
                role: u.role ?? "user",
                banned: u.banned ?? false,
                organizationCount: _count.organizationUsers,
            })),
        };
    }),

    /**
     * Permanently delete an account from the system Rubbish bin, ahead of the auto-purge.
     * @throws TRPCError(BAD_REQUEST) if it isn't deleted, or it's now the sole owner of an org.
     */
    purgeUser: systemAdminProcedure
        .input(z.object({ userId: UserId.schema }))
        .mutation(async ({ ctx, input }) => {
            await UserAccounts.purge(systemServiceContext(ctx), input.userId);
            await revalidateOrganizationUser(input.userId);
        }),

    /** Recover an account from the system Rubbish bin; it signs in again from scratch. */
    recoverUser: systemAdminProcedure
        .input(z.object({ userId: UserId.schema }))
        .mutation(async ({ ctx, input }) => {
            await UserAccounts.recover(systemServiceContext(ctx), input.userId);
            await revalidateOrganizationUser(input.userId);
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
     * Promote a user to the global `admin` role, or demote them to `user`.
     *
     * Guards, in order: (a) you cannot change your own role; (b) demoting the last remaining
     * system administrator is refused (mirrors `deleteUser`'s last-admin guard). Promotion needs
     * no guard. A call that doesn't change the role returns early — no guard, no session churn.
     *
     * On a demotion (`role === "user"`) the target's `session` rows are deleted in the same
     * `$transaction` as the `user.update` — `session.cookieCache` lasts 5 minutes, so without
     * this a just-demoted admin keeps `systemAdmin` access until it expires (mirrors
     * `deleteUser`). Promotion is a plain `user.update` — nothing to atomically pair.
     *
     * The audit entry is user-scoped and owned by the subject (`ownerId: input.userId`), so it
     * cascades away if that user is later deleted.
     */
    setUserRole: systemAdminProcedure
        .input(z.object({ userId: UserId.schema, role: z.enum(["admin", "user"]) }))
        .mutation(async ({ ctx, input }) => {
            if (input.userId === ctx.auth.user.id) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "You cannot change your own role.",
                });
            }

            const target = await ctx.prisma.user.findUnique({
                where: { id: input.userId },
                select: { id: true, role: true },
            });
            if (!target) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `User ${input.userId} not found.`,
                });
            }

            // No admin-role transition: skip the last-admin guard and the session
            // revocation — a no-op update must not log the target out.
            const currentRole = target.role === "admin" ? "admin" : "user";
            if (currentRole === input.role) {
                return { id: target.id, role: input.role };
            }

            if (input.role === "user") {
                const otherAdmins = await ctx.prisma.user.count({
                    where: { role: "admin", id: { not: input.userId }, status: { not: "Deleted" } },
                });
                if (otherAdmins === 0) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "Cannot demote the last system administrator.",
                    });
                }

                const [updated] = await ctx.prisma.$transaction([
                    ctx.prisma.user.update({
                        where: { id: input.userId },
                        data: { role: input.role },
                    }),
                    ctx.prisma.session.deleteMany({ where: { userId: input.userId } }),
                    ctx.logEvent({
                        ownerId: input.userId,
                        action: "Update",
                        objectType: "User",
                        objectId: input.userId,
                        changes: diffObject({ role: currentRole }, { role: input.role }),
                        description: `Changed global role from ${currentRole} to ${input.role}`,
                    }),
                ]);

                return { id: updated.id, role: updated.role };
            }

            const [updated] = await ctx.prisma.$transaction([
                ctx.prisma.user.update({
                    where: { id: input.userId },
                    data: { role: input.role },
                }),
                ctx.logEvent({
                    ownerId: input.userId,
                    action: "Update",
                    objectType: "User",
                    objectId: input.userId,
                    changes: diffObject({ role: currentRole }, { role: input.role }),
                    description: `Changed global role from ${currentRole} to ${input.role}`,
                }),
            ]);

            return { id: updated.id, role: updated.role };
        }),

    /**
     * Lift a ban on a user account, allowing them to sign in again. `BAD_REQUEST` if the target
     * is the caller — see `banUser`; unreachable in practice since a banned caller can't hold a
     * session to invoke this, but kept for symmetry with `banUser`'s guard.
     */
    unbanUser: systemAdminProcedure
        .input(z.object({ userId: UserId.schema }))
        .mutation(async ({ ctx, input }) => {
            if (input.userId === ctx.auth.user.id) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "You cannot unban your own account.",
                });
            }

            const target = await ctx.prisma.user.findUnique({
                where: { id: input.userId },
                select: { id: true },
            });
            if (!target) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: `User ${input.userId} not found.`,
                });
            }

            await auth.api.unbanUser({
                headers: await ctx.getHeaders(),
                body: { userId: input.userId },
            });

            await ctx.logEvent({
                ownerId: input.userId,
                action: "Unban",
                objectType: "User",
                objectId: input.userId,
                changes: [],
            });

            return { id: input.userId };
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
