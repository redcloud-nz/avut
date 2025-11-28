/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { headers as nextHeaders } from "next/headers";
import { cache } from "react";
import superjson from "superjson";
import { z } from "zod";

import { initTRPC, TRPCError } from "@trpc/server";

import { Permissions } from "@/lib/permissions";
import { auth, AuthSession } from "@/server/auth";
import prisma from "@/server/prisma";

// Artificial delay in development to simulate real-world conditions
const DEVELOPMENT_DELAY = { min: 250, max: 1000 }; // ms

export function createInnerTrpcContext({
    authSession,
    hasPermission,
}: {
    authSession: AuthSession | null;
    hasPermission(permissions: Permissions): Promise<void>;
}) {
    return {
        prisma,
        authSession,
        hasPermission,
    };
}

export const createTrpcContext = cache(async () => {
    const headers = await nextHeaders();

    // Get the current auth session
    const authSession = await auth.api.getSession({
        headers,
    });

    return createInnerTrpcContext({
        authSession,
        hasPermission: async (permissions: Permissions) => {
            try {
                await auth.api.hasPermission({
                    headers,
                    body: {
                        permissions,
                    },
                });
            } catch (error) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Insufficient permissions.",
                    cause: error,
                });
            }
        },
    });
});

type Context = Awaited<ReturnType<typeof createTrpcContext>>;

const t = initTRPC.context<Context>().create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
        return {
            ...shape,
            cause: error.cause,
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

export type AuthenticatedContext = Context & { authSession: AuthSession };

/**
 * Procedure that requires the user to be authenticated.
 * @throws TRPCError with code 'UNAUTHORIZED' if not authenticated.
 */
export const authenticatedProcedure = publicProcedure.use((opts) => {
    const { ctx } = opts;
    if (ctx.authSession == null) {
        throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "User is not authenticated.",
        });
    }

    const enhancedCtx: AuthenticatedContext = {
        ...ctx,
        authSession: ctx.authSession,
    };

    return opts.next({
        ctx: enhancedCtx,
    });
});

export const organizationProcedure = authenticatedProcedure
    .input(z.object({ organizationId: z.string() }))
    .use(async (opts) => {
        if (
            opts.ctx.authSession.session.activeOrganizationId !=
            opts.input.organizationId
        ) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "Invalid organization access.",
            });
        }

        return opts.next({});
    });
