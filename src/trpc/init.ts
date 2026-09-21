/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import superjson from "superjson";
import * as z from "zod";

import { initTRPC, TRPCError } from "@trpc/server";

import type { LogEntry, Prisma } from "@/generated/prisma/client";
import { DiffChange } from "@/lib/diff";
import { Permissions } from "@/lib/permissions";
import type { LogAction, LogObjectType } from "@/lib/schemas/log-entry";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import type { AuthSession } from "@/server/auth";
// NOTE: import type only — @/server/auth loads server-only modules and must not be imported at runtime here
import { recordLogEntry, resolveActor, type LogEntryRef } from "@/server/log-entry";
import prisma from "@/server/prisma";

import { formatTrpcError } from "./error-formatter";

// Artificial delay in development approximating the client-to-server network round trip for a
// real user (as opposed to `localhost`, which has none). Deliberately small — this fires once
// per tRPC call regardless of how many DB queries it makes; the per-query DB round trip is
// simulated separately in `server/prisma.ts`, additively, so sequential vs. parallel query
// patterns actually show up as different wall-clock time in dev instead of being masked by one
// flat delay per procedure.
const DEVELOPMENT_DELAY = { min: 20, max: 80 }; // ms

/**
 * Create the inner tRPC context.
 */
export function createInnerTrpcContext({
    auth,
    hasPermission,
    getHeaders,
}: {
    auth: AuthSession | null;
    hasPermission(organizationId: OrganizationId, permissions: Permissions): Promise<void>;
    /**
     * Lazily resolves the request's headers — only two procedures need them (passthroughs to
     * Better Auth calls that want the raw request), so this stays unread rather than costing
     * every call an unconditional `next/headers` read it has no use for.
     */
    getHeaders(): Promise<Headers>;
}) {
    return {
        prisma,
        auth,
        hasPermission,
        getHeaders,
    };
}

type Context = ReturnType<typeof createInnerTrpcContext>;

const t = initTRPC.context<Context>().create({
    transformer: superjson,
    errorFormatter: ({ shape, error }) => formatTrpcError({ shape, error }),
});

// Base router
export const createTrpcRouter = t.router;

//
export type PublicContext = Context;

export const publicProcedure = t.procedure.use(async function artificialDelayInDevelopment(opts) {
    if (process.env.NODE_ENV === "development") {
        const start = performance.now();
        const delay =
            Math.floor(Math.random() * (DEVELOPMENT_DELAY.max - DEVELOPMENT_DELAY.min + 1)) +
            DEVELOPMENT_DELAY.min;

        const [res] = await Promise.all([
            opts.next(opts),
            new Promise((resolve) => setTimeout(resolve, delay)),
        ]);
        const durationMs = Math.round(performance.now() - start);
        console.debug(`[trpc] ${opts.path} — ${durationMs}ms (+${delay}ms artificial)`);
        return res;
    }

    return opts.next(opts);
});

export type AuthenticatedContext = Context & {
    auth: AuthSession;
    userId: UserId;
    /**
     * Records an entry in the calling user's own log — account-level events with no
     * organization. Returns the un-awaited `PrismaPromise`, same contract as the
     * organization-scoped helper.
     */
    logEvent: (
        options: LogEventOptions,
        tx?: Prisma.TransactionClient,
    ) => Prisma.PrismaPromise<LogEntry>;
};

/**
 * Procedure that requires the user to be authenticated.
 * @throws TRPCError with code 'UNAUTHORIZED' if not authenticated.
 */
export const authenticatedProcedure = publicProcedure.use((opts) => {
    const { ctx } = opts;
    if (ctx.auth == null) {
        throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User is not authenticated.",
        });
    }

    const auth = ctx.auth;
    const userId = UserId.schema.parse(auth.user.id);

    const enhancedCtx: AuthenticatedContext = {
        ...ctx,
        auth,
        userId,
        logEvent(options: LogEventOptions, tx: Prisma.TransactionClient = ctx.prisma) {
            const { actor, actorLabel } = resolveActor(auth);

            return recordLogEntry(
                { scope: "user", ownerId: userId, actor, actorLabel, ...options },
                tx,
            );
        },
    };

    return opts.next({
        ctx: enhancedCtx,
    });
});

/**
 * `Omit<…, "logEvent">` is load-bearing. A plain intersection would merge the inherited
 * `logEvent` signature with this one into an overload set, and a call passing
 * `organizationId` would resolve against the inherited signature and be rejected as an
 * excess property. Replacing the member outright is what makes the system-admin options
 * type actually usable.
 */
export type SystemAdminContext = Omit<AuthenticatedContext, "logEvent"> & {
    logEvent: (
        options: SystemAdminLogEventOptions,
        tx?: Prisma.TransactionClient,
    ) => Prisma.PrismaPromise<LogEntry>;
};

/**
 * Procedure that requires the authenticated user to be a site-wide administrator
 * (Better Auth `admin` plugin — `session.user.role === "admin"`). This is distinct
 * from the org-scoped permission system used by `organizationProcedure`.
 * @throws TRPCError with code 'FORBIDDEN' if the user is not a global admin.
 */
export const systemAdminProcedure = authenticatedProcedure.use(async ({ ctx, next }) => {
    if (ctx.auth.user.role !== "admin") {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: "System administrator access required.",
        });
    }

    const enhancedCtx: SystemAdminContext = {
        ...ctx,
        logEvent(options: SystemAdminLogEventOptions, tx: Prisma.TransactionClient = ctx.prisma) {
            const { actor, actorLabel } = resolveActor(ctx.auth);
            const { organizationId, ownerId, scope, ...rest } = options;

            if (organizationId != null) {
                return recordLogEntry(
                    { scope: "organization", organizationId, actor, actorLabel, ...rest },
                    tx,
                );
            }
            if (ownerId != null) {
                return recordLogEntry({ scope: "user", ownerId, actor, actorLabel, ...rest }, tx);
            }

            // The union leaves no fourth possibility: with neither FK, `scope` is present
            // and is `"system"`.
            return recordLogEntry({ scope, actor, actorLabel, ...rest }, tx);
        },
    };

    return next({ ctx: enhancedCtx });
});

export type AuthenticatedOrganizationContext = AuthenticatedContext & {
    organizationId: OrganizationId;
    /**
     * Records an entry in the organization's change-log.
     *
     * Returns the underlying `PrismaPromise` rather than awaiting it internally, so it can be
     * used two ways:
     * - Standalone: `await ctx.logEvent(options)` — executes immediately, same as before.
     * - Atomically alongside another write: pass it unawaited into `ctx.prisma.$transaction([...])`
     *   (default `tx`), or await it with an explicit `tx` inside `ctx.prisma.$transaction(async (tx) => ...)`.
     */
    logEvent: (
        options: LogEventOptions,
        tx?: Prisma.TransactionClient,
    ) => Prisma.PrismaPromise<LogEntry>;
};

/**
 * An organization scoped procedure that checks for required permissions.
 * @param requiredPermissions The permissions required to access this procedure.
 * @returns A tRPC procedure with organization context and permission checks.
 */
export function organizationProcedure(requiredPermissions: Permissions = {}) {
    // Ensure that the required organization permissions include at least 'organization:view'
    requiredPermissions = {
        ...requiredPermissions,
        organization: requiredPermissions.organization?.includes("view")
            ? requiredPermissions.organization
            : [...(requiredPermissions.organization ?? []), "view"],
    };

    return authenticatedProcedure
        .meta({ requiresOrganization: true, requiredPermissions })
        .input(z.object({ organizationId: OrganizationId.schema }))

        .use(async (opts) => {
            // Check organization permissions
            await opts.ctx.hasPermission(opts.input.organizationId, requiredPermissions);

            function logEvent(
                options: LogEventOptions,
                tx: Prisma.TransactionClient = opts.ctx.prisma,
            ) {
                const { actor, actorLabel } = resolveActor(opts.ctx.auth);

                return recordLogEntry(
                    {
                        scope: "organization",
                        organizationId: opts.input.organizationId,
                        actor,
                        actorLabel,
                        ...options,
                    },
                    tx,
                );
            }

            return opts.next({
                ctx: {
                    ...opts.ctx,
                    organizationId: opts.input.organizationId,
                    logEvent,
                } satisfies AuthenticatedOrganizationContext,
            });
        });
}

export interface LogEventOptions {
    action: LogAction;
    objectType: LogObjectType;
    objectId: string;
    changes?: DiffChange[];
    description?: string;
    /** Extra entities this entry is relevant to. The primary is implicit. */
    refs?: LogEntryRef[];
    /** An existing `LogBatch.id`, when this entry is part of a multi-entry operation. */
    batchId?: string;
}

/**
 * A system administrator acts outside any one organization, so the target log is chosen
 * per call, and exactly one of three ways:
 *
 * - `organizationId` — the entry belongs to that organization's log.
 * - `ownerId` — the entry belongs to the subject user's own log. Note that
 *   `log_entries.ownerId` is `onDelete: Cascade`, so such an entry dies with that user.
 *   Never use this arm to record the *deletion* of the user it names: the entry would be
 *   cascaded away inside the very transaction that wrote it.
 * - `scope: "system"` — the entry belongs to no organization and no user. It carries no
 *   owner FK at all, so nothing can cascade it away; the subject is named by
 *   `objectId`/`description` instead. This is the arm for actions that outlive their
 *   subject, `deleteUser` being the case that forced it.
 *
 * The first two infer their scope rather than taking one — an explicit `scope` there would
 * be redundant in the valid cases and contradictory in the invalid ones. The third has no
 * FK to infer from, so `scope: "system"` is its discriminant, and passing it is what makes
 * "neither owner" a deliberate choice rather than two forgotten properties.
 */
export type SystemAdminLogEventOptions = LogEventOptions &
    (
        | { organizationId: OrganizationId; ownerId?: never; scope?: never }
        | { organizationId?: never; ownerId: UserId; scope?: never }
        | { organizationId?: never; ownerId?: never; scope: "system" }
    );
