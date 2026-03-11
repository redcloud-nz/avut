/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { headers as nextHeaders } from "next/headers";
import { cache } from "react";
import superjson from "superjson";
import * as z from "zod";

import { initTRPC, TRPCError } from "@trpc/server";

import { DiffChange } from "@/lib/diff";
import { nanoId16 } from "@/lib/id";
import { Permissions } from "@/lib/permissions";
import { OrganizationId } from "@/lib/schemas/organization";
import { auth, AuthSession } from "@/server/auth";
import prisma from "@/server/prisma";
import { FieldConflictError } from "./errors";
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
    hasPermission(
        organizationId: OrganizationId,
        permissions: Permissions,
    ): Promise<void>;
    headers: Headers;
}) {
    return {
        prisma,
        auth,
        hasPermission,
        headers,
    };
}

export const createTrpcContext = cache(async () => {
    const headers = await nextHeaders();

    // Get the current auth session
    const authSession = await auth.api.getSession({
        headers,
    });

    return createInnerTrpcContext({
        auth: authSession,
        hasPermission: async (
            organizationId: OrganizationId,
            requiredPermissions: Permissions,
        ) => {
            try {
                await auth.api.hasPermission({
                    headers,
                    body: {
                        organizationId,
                        permissions: requiredPermissions,
                    },
                });
            } catch (error) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message:
                        "Insufficient permissions. Action requires: " +
                        JSON.stringify(requiredPermissions),
                    cause: error,
                });
            }
        },
        headers,
    });
});

type Context = Awaited<ReturnType<typeof createTrpcContext>>;

const t = initTRPC.context<Context>().create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
        return {
            ...shape,
            cause: error.cause,
            data: {
                ...shape,
                conflict:
                    error.code == "CONFLICT" &&
                    error.cause instanceof FieldConflictError
                        ? {
                              fieldName: error.cause.fieldName,
                              message: error.cause.message,
                          }
                        : undefined,
            },
        };
    },
});

// Base router
export const createTrpcRouter = t.router;

//
export type PublicContext = Context;

export const publicProcedure = t.procedure.use(
    async function artificialDelayInDevelopment(opts) {
        const res = opts.next(opts);

        if (process.env.NODE_ENV === "development") {
            const delay =
                Math.floor(
                    Math.random() *
                        (DEVELOPMENT_DELAY.max - DEVELOPMENT_DELAY.min + 1),
                ) + DEVELOPMENT_DELAY.min;

            console.debug(
                `ℹ️  doing artificial delay of ${delay}ms before returning result for ${opts.path}`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
        }

        return res;
    },
);

export type AuthenticatedContext = Context & {
    auth: AuthSession;
    userId: UserId;
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

    const enhancedCtx: AuthenticatedContext = {
        ...ctx,
        auth: ctx.auth,
        userId: UserId.schema.parse(ctx.auth.user.id),
    };

    return opts.next({
        ctx: enhancedCtx,
    });
});

export type AuthenticatedOrganizationContext = AuthenticatedContext & {
    organizationId: OrganizationId;
    logEvent: (options: LogEventOptions) => Promise<void>;
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
            await opts.ctx.hasPermission(
                opts.input.organizationId,
                requiredPermissions,
            );

            async function logEvent({
                action,
                objectType,
                objectId,
                changes = [],
                description,
            }: LogEventOptions) {
                await opts.ctx.prisma.organizationLogEntry.create({
                    data: {
                        id: nanoId16(),
                        organizationId: opts.input.organizationId,
                        userId: opts.ctx.auth.user.id,
                        action,
                        objectType,
                        objectId,
                        changes: changes as object[],
                        description,
                    },
                });
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

interface LogEventOptions {
    action:
        | "Archive"
        | "Create"
        | "Delete"
        | "Publish"
        | "Restore"
        | "Subscribe"
        | "Unpublish"
        | "Unsubscribe"
        | "Update";
    objectType:
        | "D4hAccessToken"
        | "I3Template"
        | "I3TemplateVariant"
        | "Organization"
        | "OrganizationMembership"
        | "OrganizationSettings"
        | "Person"
        | "Skill"
        | "SkillGroup"
        | "SkillPackage"
        | "Team"
        | "TeamMembership";
    objectId: string;
    changes?: DiffChange[];
    description?: string;
}
