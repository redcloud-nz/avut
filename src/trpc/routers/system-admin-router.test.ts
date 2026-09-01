/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, it, expect } from "vitest";

import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";
import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";

import { systemAdminRouter } from "./system-admin-router";

describe("systemAdminProcedure gate", () => {
    const db = createMockPrisma();

    it("rejects a user whose session role is not admin", async () => {
        const ctx = createAuthenticatedMockContext({
            user: { id: UserId.create(), role: "user" },
            prisma: db,
        });
        await expect(systemAdminRouter.createCaller(ctx).health()).rejects.toMatchObject({
            code: "FORBIDDEN",
        });
    });

    it("allows a user whose session role is admin", async () => {
        const ctx = createAuthenticatedMockContext({
            user: { id: UserId.create(), role: "admin" },
            prisma: db,
        });
        await expect(systemAdminRouter.createCaller(ctx).health()).resolves.toEqual({ ok: true });
    });
});

describe("systemAdmin users", () => {
    const T = {
        admin: UserId.create(),
        u1: UserId.create(),
        u2: UserId.create(),
        org: OrganizationId.create(),
    };
    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.admin, T.u1, T.u2]) {
            await db.user.create({
                data: {
                    id,
                    name: `U-${id}`,
                    email: `${id}@x.test`,
                    emailVerified: true,
                    createdAt: new Date(),
                },
            });
        }
        await db.organization.create({
            data: { id: T.org, name: "Org", slug: "org", createdAt: new Date() },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.u1,
                role: "member",
                createdAt: new Date(),
            },
        });
    });

    const call = () =>
        systemAdminRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.admin, role: "admin" }, prisma: db }),
        );

    it("listUsers returns every user with membership count", async () => {
        const { users } = await call().listUsers();
        expect(users).toHaveLength(3);
        expect(users.find((u) => u.id === T.u1)?.organizationCount).toBe(1);
        expect(users.find((u) => u.id === T.u2)?.organizationCount).toBe(0);
    });

    it("getUser returns the user with organization memberships", async () => {
        const user = await call().getUser({ userId: T.u1 });
        expect(user.organizations).toEqual([
            { id: T.org, name: "Org", slug: "org", role: "member" },
        ]);
    });

    it("getUser throws NOT_FOUND for an unknown id", async () => {
        await expect(call().getUser({ userId: UserId.create() })).rejects.toMatchObject({
            code: "NOT_FOUND",
        });
    });
});
