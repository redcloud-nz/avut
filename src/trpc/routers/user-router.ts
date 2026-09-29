/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { TRPCError } from "@trpc/server";

import type { Prisma } from "@/generated/prisma/client";
import { type LogAction, type LogObjectType } from "@/lib/schemas/log-entry";
import { OrganizationData, OrganizationId } from "@/lib/schemas/organization";
import { InvitationId, OrganizationInvitationData } from "@/lib/schemas/organization-invitation";
import { OrganizationUser } from "@/lib/schemas/organization-user";
import { UserData, UserId } from "@/lib/schemas/user";
import { UserSessionData } from "@/lib/schemas/user-session";
import { auth } from "@/server/auth";
import { revalidateOrganizationUser } from "@/server/cache/organization-user-revalidate";
import { createLogBatch, formatActorLabel, recordLogEntry, resolveActor } from "@/server/log-entry";
import * as Personnel from "@/server/services/personnel";
import type { OrgServiceContext } from "@/server/services/service-context";
import * as UserAccounts from "@/server/services/user-accounts";

import {
    authenticatedProcedure,
    closedAccountProcedure,
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
 * Records a self-service membership change on both timelines it belongs to: the caller's own
 * (`ctx.logEvent` is user-scoped for an `authenticatedProcedure`) and the organization's, which
 * would otherwise never learn that a member joined, turned down an invitation, or left.
 *
 * Two independently meaningful events, so they share a `LogBatch`. Written in one interactive
 * transaction — the batch has to exist before the entries that reference it, and its id is only
 * known once it is created.
 */
async function logMembershipEvent(
    ctx: AuthenticatedContext,
    input: {
        operationKey: "invitation-accept" | "invitation-reject" | "organization-leave";
        organizationId: string;
        action: LogAction;
        objectType: LogObjectType;
        objectId: string;
        description: string;
    },
    /** A write that belongs with the entries — it commits or rolls back with them. */
    write?: (tx: Prisma.TransactionClient) => Promise<unknown>,
) {
    const { operationKey, organizationId, ...entry } = input;

    await ctx.prisma.$transaction(async (tx) => {
        await write?.(tx);

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

            // Better Auth creates the membership and runs `afterAcceptInvitation` (role cache
            // revalidation only — person-linking happens below, not in that hook). It isn't a
            // Prisma operation, so it can't join a $transaction with the log entries — log only
            // once it has succeeded.
            const { member } = await auth.api.acceptInvitation({
                body: { invitationId: invitation.id },
                headers: await ctx.getHeaders(),
            });

            // Attach a person record to the membership just created — the one named by the
            // invitation, or (when the organization opted in) one matching the accepting user's
            // email. Never allowed to fail the accept: the membership is already committed by
            // this point, so throwing would leave the user staring at an error for an invitation
            // that did in fact work.
            try {
                const organizationId = OrganizationId.schema.parse(invitation.organizationId);
                const orgCtx: OrgServiceContext = {
                    prisma: ctx.prisma,
                    organizationId,
                    userId: ctx.userId,
                    logEvent: (options, tx = ctx.prisma) =>
                        recordLogEntry(
                            {
                                scope: "organization",
                                organizationId,
                                ...resolveActor(ctx.auth),
                                ...options,
                            },
                            tx,
                        ),
                };

                const linked = await Personnel.linkPersonOnInvitationAccept(orgCtx, {
                    invitationPersonId: invitation.personId ?? null,
                    email: ctx.auth.user.email,
                });

                if (linked) {
                    console.log(
                        `Attached User(${ctx.userId}) to Person(${linked.personId}) in Organization(${invitation.organizationId})`,
                    );
                }
            } catch (error) {
                console.error(
                    `Failed to link a person to User(${ctx.userId}) in Organization(${invitation.organizationId}) on invitation accept:`,
                    error,
                );
            }

            await logMembershipEvent(ctx, {
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
     * Close the caller's own account (#150): the same soft delete a system administrator does,
     * into the system Rubbish bin for `USER_RETENTION_DAYS`, with the same guards. Closing as an
     * organization's sole owner is allowed — the dialog lists those organizations first
     * (`listSoleOwnedOrganizations`). Every session is revoked, this
     * one included, so the client signs out afterwards. Person records in each organization are
     * the organization's and are kept.
     *
     * The entry is `scope: "system"`: a user-scoped one would be cascaded away by the purge.
     * @throws TRPCError(BAD_REQUEST) if `confirmEmail` doesn't match, or a guard refuses it.
     */
    closeMyAccount: authenticatedProcedure
        .input(z.object({ confirmEmail: z.string() }))
        .mutation(async ({ ctx, input }) => {
            if (input.confirmEmail.trim().toLowerCase() !== ctx.auth.user.email.toLowerCase()) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Type your email address exactly to confirm.",
                });
            }

            await UserAccounts.softDelete(
                {
                    prisma: ctx.prisma,
                    logSystemEvent: (options, tx = ctx.prisma) =>
                        recordLogEntry(
                            { scope: "system", ...resolveActor(ctx.auth), ...options },
                            tx,
                        ),
                },
                ctx.userId,
                "self",
            );
            await revalidateOrganizationUser(ctx.userId);
        }),

    /**
     * What `/auth/account-closed` shows a closed account: whether its owner may restore it
     * (only if they closed it themselves) and when it will be purged.
     */
    getAccountClosure: closedAccountProcedure
        .output(
            z.object({
                closed: z.boolean(),
                canRestore: z.boolean(),
                purgeAt: z.iso.datetime().nullable(),
            }),
        )
        .query(async ({ ctx }) => {
            const deleted = await UserAccounts.getDeleted(ctx.prisma, ctx.userId);
            return {
                closed: deleted !== null,
                canRestore: deleted !== null && ctx.auth.user.deletedBy === "Self",
                purgeAt: deleted?.purgeAt?.toISOString() ?? null,
            };
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
     * Leaves an organization the caller is a member of. Leaving as its only owner is allowed —
     * the leave dialog warns and asks for the organization's name first — and a system admin can
     * appoint a new owner afterwards (`organizations.makeOwner`).
     *
     * Deletes the membership itself rather than through Better Auth's `/organization/leave`,
     * which refuses the last owner (that path is disabled in `server/auth.ts`).
     *
     * @param ctx The authenticated context.
     * @param input The organization to leave.
     * @throws TRPCError(NOT_FOUND) if the caller is not a member of that organization.
     */
    leaveOrganization: authenticatedProcedure
        .input(z.object({ organizationId: OrganizationId.schema }))
        .mutation(async ({ ctx, input }) => {
            const membership = await ctx.prisma.organizationUser.findFirst({
                where: { organizationId: input.organizationId, userId: ctx.userId },
                select: { id: true, organization: { select: { name: true } } },
            });
            if (!membership) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "You are not a member of that organisation.",
                });
            }

            await logMembershipEvent(
                ctx,
                {
                    operationKey: "organization-leave",
                    organizationId: input.organizationId,
                    action: "Delete",
                    objectType: "OrganizationMembership",
                    objectId: membership.id,
                    description: `Left ${membership.organization.name} (${input.organizationId}).`,
                },
                (tx) => tx.organizationUser.delete({ where: { id: membership.id } }),
            );

            // The caller's cached roles would otherwise keep granting access to the org.
            await revalidateOrganizationUser(ctx.userId);

            return { ok: true as const };
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
     * The organizations the caller is the only owner of — what leaving them, or closing the
     * account, would leave with no owner. The leave and close-account dialogs warn with it.
     */
    listSoleOwnedOrganizations: authenticatedProcedure
        .output(z.array(z.object({ id: OrganizationId.schema, name: z.string() })))
        .query(async ({ ctx }) => {
            const orgs = await UserAccounts.getSoleOwnedOrganizations(ctx, ctx.userId);
            return orgs.map((o) => ({ ...o, id: OrganizationId.schema.parse(o.id) }));
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

            await logMembershipEvent(ctx, {
                operationKey: "invitation-reject",
                organizationId: invitation.organizationId,
                action: "Update",
                objectType: "OrganizationInvitation",
                objectId: invitation.id,
                description: `Rejected invitation to join ${invitation.organization.name} (${invitation.organizationId}).`,
            });
        }),

    /**
     * The owner restoring an account they closed, from `/auth/account-closed`. An account a
     * system administrator deleted is refused — that's the administrator's call to undo.
     */
    restoreMyAccount: closedAccountProcedure.mutation(async ({ ctx }) => {
        await UserAccounts.restoreOwn(
            {
                prisma: ctx.prisma,
                logSystemEvent: (options, tx = ctx.prisma) =>
                    recordLogEntry({ scope: "system", ...resolveActor(ctx.auth), ...options }, tx),
            },
            ctx.userId,
        );
        await revalidateOrganizationUser(ctx.userId);
    }),
});
