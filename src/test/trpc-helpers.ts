/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { addDays } from "date-fns";
import { beforeEach, vi } from "vitest";

import { TRPCError } from "@trpc/server";

import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { nanoId16 } from "@/lib/id";
import { Permissions } from "@/lib/permissions";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import type { AuthSession } from "@/server/auth";
import { recordLogEntry, resolveActor } from "@/server/log-entry";
import type { LogEventOptions } from "@/trpc/init";

const mockDate = new Date("2020-01-01T00:00:00.000Z");
const nowDate = new Date();

interface CreateAuthenticatedMockContextOverrides {
    user: Partial<AuthSession["user"]> & Pick<AuthSession["user"], "id">;
    session?: Partial<AuthSession["session"]> & { impersonatedBy?: string | null };
    permissions?: Permissions;
    prisma: PrismaClient;
}

export const createAuthenticatedMockContext = ({
    user,
    session = {},
    permissions = {},
    prisma,
}: CreateAuthenticatedMockContextOverrides) => {
    return {
        prisma,
        auth: {
            user: {
                createdAt: mockDate,
                updatedAt: mockDate,
                name: "Test User",
                email: "test-user@example.com",
                emailVerified: true,
                banned: false,
                role: "user",
                ...user,
            } satisfies AuthSession["user"],
            session: {
                ...({
                    id: nanoId16(),
                    createdAt: mockDate,
                    updatedAt: mockDate,
                    expiresAt: addDays(nowDate, 1),
                    userId: user.id,
                    token: "mock-session-token",
                } satisfies AuthSession["session"]),
                ...session,
            },
        },
        hasPermission: async (organizationId: OrganizationId, requiredPermissions: Permissions) => {
            for (const key in requiredPermissions) {
                const permKey = key as keyof Permissions;
                const requiredPermValue: string[] = requiredPermissions[permKey] || [];
                const userPermValues: string[] = permissions[permKey] || [];

                for (const value of requiredPermValue) {
                    if (!userPermValues.includes(value)) {
                        throw new TRPCError({
                            code: "FORBIDDEN",
                            message:
                                "Insufficient permissions. Action requires: " +
                                JSON.stringify(requiredPermissions),
                        });
                    }
                }
            }
        },
        getHeaders: async () => new Headers(),
    };
};

/**
 * A context as `organizationProcedure` builds it — the authenticated context plus the
 * `organizationId` and `logEvent` that the middleware injects.
 *
 * Use this to call an exported domain-service function directly, rather than through
 * `createCaller`, when it takes arguments no procedure exposes. The D4H team import is the case
 * that needs it: it calls `Personnel.create(withBatch(ctx, batchId), id, data)` with a batch that
 * no procedure ever passes, so the batched path is unreachable through a caller.
 *
 * `logEvent` shares `resolveActor` with `src/trpc/init.ts` rather than restating it, so the
 * impersonation rule — an action taken while impersonating is attributed to the impersonator —
 * cannot drift between the two.
 */
export const createOrganizationMockContext = ({
    organizationId,
    ...overrides
}: CreateAuthenticatedMockContextOverrides & { organizationId: OrganizationId }) => {
    const ctx = createAuthenticatedMockContext(overrides);
    const { auth } = ctx;

    function logEvent(options: LogEventOptions, tx: Prisma.TransactionClient = ctx.prisma) {
        return recordLogEntry(
            { scope: "organization", organizationId, ...resolveActor(auth), ...options },
            tx,
        );
    }

    return {
        ...ctx,
        organizationId,
        userId: UserId.schema.parse(auth.user.id),
        isSystemAdmin: auth.user.role === "admin",
        logEvent,
    };
};

// Reset all mocks before each test
beforeEach(() => {
    vi.clearAllMocks();
});
