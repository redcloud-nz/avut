/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import * as z from "zod";

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import {
    authenticatedProcedure,
    createTrpcRouter,
    organizationProcedure,
    systemAdminProcedure,
    teamProcedure,
} from "./init";

const T = {
    org: OrganizationId.create(),
    user: UserId.create(),
    admin: UserId.create(),
};

const db = createMockPrisma();

const testRouter = createTrpcRouter({
    orgMember: organizationProcedure().query(() => ({ ok: true as const })),

    orgScope: organizationProcedure({ organization: ["view"] }).query(() => ({
        ok: true as const,
    })),

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

    systemAdminWrite: systemAdminProcedure
        .input(
            z.object({
                target: z.enum(["organization", "user", "system"]),
                objectId: z.string(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const common = {
                action: "Delete",
                objectType: "User",
                objectId: input.objectId,
            } as const;

            if (input.target === "organization") {
                await ctx.logEvent({ organizationId: T.org, ...common });
            } else if (input.target === "user") {
                await ctx.logEvent({ ownerId: T.user, ...common });
            } else {
                await ctx.logEvent({ scope: "system", ...common });
            }

            return { ok: true as const };
        }),

    teamMember: teamProcedure().query(({ ctx }) => ({
        teamId: ctx.teamId,
        teamSlug: ctx.teamSlug,
        organizationId: ctx.organizationId,
        isSystemAdmin: ctx.isSystemAdmin,
    })),

    teamWrite: teamProcedure({ person: ["update"] })
        .input(z.object({ personId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.logEvent({
                action: "Update",
                objectType: "Person",
                objectId: input.personId,
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

describe("organizationProcedure permissions", () => {
    // `organization: ["view"]` means "can enter the org scope", not "is a member" (#523), so
    // the procedure adds nothing to what it's given.
    function callerWith(permissions: Record<string, string[]>) {
        return testRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: T.user }, permissions, prisma: db }),
        );
    }

    it("lets in a member without organization:view when it asks for nothing", async () => {
        await expect(callerWith({}).orgMember({ organizationId: T.org })).resolves.toEqual({
            ok: true,
        });
    });

    it("doesn't add organization:view to the permissions it asks for", async () => {
        await expect(
            callerWith({ person: ["update"] }).orgWrite({
                organizationId: T.org,
                personId: "person_4",
            }),
        ).resolves.toEqual({ ok: true });
    });

    it("refuses a member without organization:view when it asks for it", async () => {
        await expect(callerWith({}).orgScope({ organizationId: T.org })).rejects.toMatchObject({
            code: "FORBIDDEN",
        });
        await expect(
            callerWith({ organization: ["view"] }).orgScope({ organizationId: T.org }),
        ).resolves.toEqual({ ok: true });
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

describe("systemAdminProcedure.logEvent", () => {
    function makeAdminCaller() {
        return testRouter.createCaller(
            createAuthenticatedMockContext({
                user: {
                    id: T.admin,
                    name: "Dana Okafor",
                    email: "dana@example.com",
                    role: "admin",
                },
                prisma: db,
            }),
        );
    }

    it("puts the entry in an organization's log when given an organizationId", async () => {
        await makeAdminCaller().systemAdminWrite({
            target: "organization",
            objectId: "sysadmin_org",
        });

        const entry = (await db.logEntry.findMany({ where: { objectId: "sysadmin_org" } }))[0];
        expect(entry).toMatchObject({
            scope: "organization",
            organizationId: T.org,
            ownerId: null,
            userId: T.admin,
        });
    });

    it("puts the entry in the subject user's own log when given an ownerId", async () => {
        await makeAdminCaller().systemAdminWrite({ target: "user", objectId: "sysadmin_user" });

        const entry = (await db.logEntry.findMany({ where: { objectId: "sysadmin_user" } }))[0];
        expect(entry).toMatchObject({
            scope: "user",
            organizationId: null,
            ownerId: T.user,
            userId: T.admin,
        });
    });

    /*
     * The third arm exists so an action can outlive its subject: with neither owner FK set,
     * there is nothing for a `User` or `Organization` deletion to cascade through.
     */
    it('writes an owner-less system entry when given scope: "system"', async () => {
        await makeAdminCaller().systemAdminWrite({ target: "system", objectId: "sysadmin_system" });

        const entry = (await db.logEntry.findMany({ where: { objectId: "sysadmin_system" } }))[0];
        expect(entry).toMatchObject({
            scope: "system",
            organizationId: null,
            ownerId: null,
            userId: T.admin,
        });
    });

    it("refuses a caller whose session role is not admin", async () => {
        await expect(
            makeCaller().systemAdminWrite({ target: "system", objectId: "sysadmin_denied" }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
});

describe("teamProcedure", () => {
    const G = {
        org: OrganizationId.create(),
        team: TeamId.create(),
        member: UserId.create(),
        ungranted: UserId.create(),
        admin: UserId.create(),
    };

    beforeAll(async () => {
        await db.organization.create({
            data: { id: G.org, name: "Team Org", slug: "team-org", createdAt: new Date() },
        });
        for (const userId of [G.member, G.ungranted, G.admin]) {
            await db.user.create({
                data: { id: userId, name: userId, email: `${userId}@example.com` },
            });
            await db.organizationUser.create({
                data: { id: nanoId16(), organizationId: G.org, userId },
            });
        }
        await db.team.create({
            data: {
                id: G.team,
                organizationId: G.org,
                name: "Rescue Team",
                slug: "rescue",
                tags: [],
                properties: {},
            },
        });
        await db.teamUser.create({
            data: { id: nanoId16(), organizationId: G.org, teamId: G.team, userId: G.member },
        });
    });

    function callerFor(
        userId: UserId,
        options: { permissions?: Record<string, string[]>; role?: string } = {},
    ) {
        const ctx = createAuthenticatedMockContext({
            user: {
                id: userId,
                name: "Grace Hopper",
                email: "grace@example.com",
                ...(options.role ? { role: options.role } : {}),
            },
            permissions: options.permissions ?? {},
            prisma: db,
        });
        const hasPermission = vi.fn(ctx.hasPermission);
        return { caller: testRouter.createCaller({ ...ctx, hasPermission }), hasPermission };
    }

    it("lets a granted member in with no permissions, with the team and its org on ctx", async () => {
        const { caller, hasPermission } = callerFor(G.member);

        await expect(caller.teamMember({ teamSlug: "rescue" })).resolves.toEqual({
            teamId: G.team,
            teamSlug: "rescue",
            organizationId: G.org,
            isSystemAdmin: false,
        });
        expect(hasPermission).toHaveBeenCalledWith(G.org, {});
    });

    it("refuses an unknown slug with NOT_FOUND", async () => {
        const { caller } = callerFor(G.member);

        await expect(caller.teamMember({ teamSlug: "nobody" })).rejects.toMatchObject({
            code: "NOT_FOUND",
        });
    });

    it("refuses an org member without a grant with NOT_FOUND, before any permission check", async () => {
        const { caller, hasPermission } = callerFor(G.ungranted, {
            permissions: { person: ["update"] },
        });

        await expect(caller.teamMember({ teamSlug: "rescue" })).rejects.toMatchObject({
            code: "NOT_FOUND",
        });
        expect(hasPermission).not.toHaveBeenCalled();
    });

    it("refuses a system admin without a grant with NOT_FOUND", async () => {
        const { caller } = callerFor(G.admin, { role: "admin" });

        await expect(caller.teamMember({ teamSlug: "rescue" })).rejects.toMatchObject({
            code: "NOT_FOUND",
        });
    });

    it("refuses a granted member without the required permission with FORBIDDEN", async () => {
        const { caller } = callerFor(G.member);

        await expect(
            caller.teamWrite({ teamSlug: "rescue", personId: "team_person_denied" }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("writes ctx.logEvent entries to the team's organization log", async () => {
        const { caller } = callerFor(G.member, { permissions: { person: ["update"] } });

        await caller.teamWrite({ teamSlug: "rescue", personId: "team_person_1" });

        const entries = await db.logEntry.findMany({ where: { objectId: "team_person_1" } });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            scope: "organization",
            organizationId: G.org,
            ownerId: null,
            userId: G.member,
            actorLabel: "Grace Hopper <grace@example.com>",
        });
    });
});
