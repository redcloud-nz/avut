/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { systemRouter } from "./system-router";

describe("systemAdminProcedure gate", () => {
    const db = createMockPrisma();

    it("rejects a user whose session role is not admin", async () => {
        const ctx = createAuthenticatedMockContext({
            user: { id: UserId.create(), role: "user" },
            prisma: db,
        });
        await expect(systemRouter.createCaller(ctx).health()).rejects.toMatchObject({
            code: "FORBIDDEN",
        });
    });

    it("allows a user whose session role is admin", async () => {
        const ctx = createAuthenticatedMockContext({
            user: { id: UserId.create(), role: "admin" },
            prisma: db,
        });
        await expect(systemRouter.createCaller(ctx).health()).resolves.toEqual({ ok: true });
    });
});
