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
import type { AuthSession } from "@/server/auth";
// NOTE: import type only — @/server/auth loads server-only modules and must not be imported at runtime here
import {
    formatActorLabel,
    recordLogEntry,
    type LogActor,
    type LogEntryRef,
} from "@/server/log-entry";
import prisma from "@/server/prisma";
import { formatTrpcError } from "./error-formatter";
import { UserId } from "@/lib/schemas/user";

// Artificial delay in development to simulate real-world conditions
const DEVELOPMENT_DELAY = { min: 250, max: 1000 }; // ms

/**
 * Create the inner tRPC context.
 */
export function createInnerTrpcContext({
    auth,
    hasPermission,
    headers,
}: {
    auth: AuthSession | null;
    hasPermission(organizationId: OrganizationId, permissions: Permissions): Promise<void>;
    headers: Headers;
}) {
    return {
        prisma,
        auth,
        hasPermission,
        headers,
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
    const res = opts.next(opts);

    if (process.env.NODE_ENV === "development") {
        const delay =
            Math.floor(Math.random() * (DEVELOPMENT_DELAY.max - DEVELOPMENT_DELAY.min + 1)) +
            DEVELOPMENT_DELAY.min;

        console.debug(
            `ℹ️  doing artificial delay of ${delay}ms before returning result for ${opts.path}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return res;
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
 * Resolve the acting user from a session, centrally.
 *
 * Impersonation is resolved here rather than at call sites: every `logEvent` caller gets
 * `impersonatorId` populated without passing anything, and none of them can forget it.
 * Without this, an action taken while impersonating is attributed to the impersonated
 * user — the log blames the victim.
 *
 * `impersonatedBy` is read structurally: the `Session` model has the column and the
 * `admin` plugin declares it, but better-auth's `$Infer` chain is not guaranteed to
 * surface it, and a cast is cheaper here than a compile break in a file every router
 * imports.
 */
function resolveActor(auth: AuthSession): { actor: LogActor; actorLabel: string } {
    const impersonatedBy = (auth.session as { impersonatedBy?: string | null }).impersonatedBy;

    return {
        actor: {
            userId: UserId.schema.parse(auth.user.id),
            impersonatorId: impersonatedBy ? UserId.schema.parse(impersonatedBy) : undefined,
        },
        actorLabel: formatActorLabel(auth.user.name, auth.user.email),
    };
}

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
            const { organizationId, ownerId, ...rest } = options;

            return recordLogEntry(
                organizationId
                    ? { scope: "organization", organizationId, actor, actorLabel, ...rest }
                    : { scope: "user", ownerId, actor, actorLabel, ...rest },
                tx,
            );
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
 * per call: an `organizationId` puts the entry in that organization's log, and its absence
 * puts it in the subject user's own log, which is what `ownerId` names.
 *
 * Scope is inferred rather than passed. An explicit `scope` alongside an `organizationId`
 * would be redundant in the valid cases and contradictory in the invalid ones.
 */
export type SystemAdminLogEventOptions = LogEventOptions &
    (
        | { organizationId: OrganizationId; ownerId?: never }
        | { organizationId?: never; ownerId: UserId }
    );
