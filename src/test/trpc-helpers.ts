/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { addDays } from "date-fns";
import { beforeEach, vi } from "vitest";

import { TRPCError } from "@trpc/server";

import type { AuthSession } from "@/server/auth";
import { PrismaClient } from "@/generated/prisma/client";
import { nanoId16 } from "@/lib/id";
import { Permissions } from "@/lib/permissions";
import { OrganizationId } from "@/lib/schemas/organization";

const mockDate = new Date("2020-01-01T00:00:00.000Z");
const nowDate = new Date();

interface CreateAuthenticatedMockContextOverrides {
    user: Partial<AuthSession["user"]> & Pick<AuthSession["user"], "id">;
    session?: Partial<AuthSession["session"]>;
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
                id: nanoId16(),
                createdAt: mockDate,
                updatedAt: mockDate,
                expiresAt: addDays(nowDate, 1),
                userId: user.id,
                token: "mock-session-token",
                ...session,
            } satisfies AuthSession["session"],
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
        headers: new Headers(),
    };
};

// Reset all mocks before each test
beforeEach(() => {
    vi.clearAllMocks();
});
