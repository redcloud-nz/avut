/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { addDays } from "date-fns";
import { beforeEach, vi } from "vitest";

import { Permissions } from "@/lib/permissions";
import { AuthSession } from "@/server/auth";
import { createInnerTrpcContext } from "@/trpc/init";
import { nanoId16 } from "@/lib/id";
import { TRPCError } from "@trpc/server";

const mockDate = new Date("2020-01-01T00:00:00.000Z");
const nowDate = new Date();

// Create a fresh instance for each test
export const createMockContext = () => {
    return {
        auth: null,
        getClerkClient: () => {
            throw new Error("Not implemented in test");
        },
        getTeamById: vi.fn().mockResolvedValue(null),
    };
};

interface CreateAuthenticatedMockContextOverrides {
    user: Partial<AuthSession["user"]> & Pick<AuthSession["user"], "id">;
    session?: Partial<AuthSession["session"]>;
    permissions?: Permissions;
}

export const createAuthenticatedMockContext = ({
    user,
    session = {},
    permissions = {},
}: CreateAuthenticatedMockContextOverrides) => {
    return createInnerTrpcContext({
        auth: {
            user: {
                createdAt: mockDate,
                updatedAt: mockDate,
                name: "Test User",
                email: "test-user@example.com",
                emailVerified: true,
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
        hasPermission: async (requiredPermissions: Permissions) => {
            for (const key in requiredPermissions) {
                const permKey = key as keyof Permissions;
                const requiredPermValue: string[] =
                    requiredPermissions[permKey] || [];
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
    });
};

// Reset all mocks before each test
beforeEach(() => {
    vi.clearAllMocks();
});
