/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import * as z from "zod";

import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { authenticatedProcedure, createTrpcRouter, organizationProcedure } from "./init";

const T = {
    org: OrganizationId.create(),
    user: UserId.create(),
    admin: UserId.create(),
};

const db = createMockPrisma();

const testRouter = createTrpcRouter({
    orgWrite: organizationProcedure({ person: ["update"] })
        .input(z.object({ personId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.logEvent({
                action: "Update",
                objectType: "Person",
                objectId: input.personId,
                refs: [{ objectType: "Team", objectId: "team_1" }],
            });
            return { ok: true as const };
        }),

    userWrite: authenticatedProcedure.mutation(async ({ ctx }) => {
        await ctx.logEvent({
            action: "Update",
            objectType: "User",
            objectId: ctx.userId,
            description: "Password changed",
        });
        return { ok: true as const };
    }),
});

function makeCaller(session: { impersonatedBy?: string | null } = {}) {
    return testRouter.createCaller(
        createAuthenticatedMockContext({
            user: { id: T.user, name: "Ada Lovelace", email: "ada@example.com" },
            session,
            permissions: { person: ["update"], organization: ["view"] },
            prisma: db,
        }),
    );
}

describe("organizationProcedure.logEvent", () => {
    it("writes an organization-scoped entry with the acting user and a denormalized label", async () => {
        await makeCaller().orgWrite({ organizationId: T.org, personId: "person_1" });

        const entries = await db.logEntry.findMany({ where: { objectId: "person_1" } });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            scope: "organization",
            organizationId: T.org,
            ownerId: null,
            userId: T.user,
            actorLabel: "Ada Lovelace <ada@example.com>",
            impersonatorId: null,
        });
    });

    it("writes the primary ref and any extra refs the call site passed", async () => {
        await makeCaller().orgWrite({ organizationId: T.org, personId: "person_2" });

        const entry = (await db.logEntry.findMany({ where: { objectId: "person_2" } }))[0];
        const objects = await db.logEntryObject.findMany({ where: { logEntryId: entry.id } });

        expect(objects.map((o) => [o.objectId, o.role]).sort()).toEqual(
            [
                ["person_2", "primary"],
                ["team_1", "context"],
            ].sort(),
        );
    });

    it("attributes an impersonated action to the admin driving it, with no call-site change", async () => {
        await makeCaller({ impersonatedBy: T.admin }).orgWrite({
            organizationId: T.org,
            personId: "person_3",
        });

        const entry = (await db.logEntry.findMany({ where: { objectId: "person_3" } }))[0];
        expect(entry.userId).toBe(T.user);
        expect(entry.impersonatorId).toBe(T.admin);
    });
});

describe("authenticatedProcedure.logEvent", () => {
    it("writes a user-scoped entry owned by the calling user", async () => {
        await makeCaller().userWrite();

        const entries = await db.logEntry.findMany({
            where: { scope: "user", objectId: T.user },
        });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            scope: "user",
            ownerId: T.user,
            organizationId: null,
            userId: T.user,
            description: "Password changed",
        });
    });
});
