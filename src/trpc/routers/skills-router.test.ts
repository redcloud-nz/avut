/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { TRPCError } from "@trpc/server";

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { SkillPackageSubscriptionId } from "@/lib/schemas/skill-package-subscription";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { skillsRouter } from "./skills-router";

// skills-router reaches @/server/auth at import time via ../init. The procedure
// under test only touches ctx.prisma (the injected mock), so stubbing server-only
// is enough to let the module load under jsdom.
vi.mock("server-only", () => ({}));

describe("skills.createSession", () => {
    // Dataset:
    //   linkedUser  → org member, linked to linkedPerson
    //   unlinkedUser → org member, no linked person record
    const T = {
        org: OrganizationId.create(),
        linkedUser: UserId.create(),
        unlinkedUser: UserId.create(),
        linkedPerson: PersonId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Test Org", slug: T.org, createdAt: new Date() },
        });

        await db.person.create({
            data: {
                id: T.linkedPerson,
                organizationId: T.org,
                name: "Alice Anderson",
                email: `${T.linkedPerson}@example.com`,
            },
        });

        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.linkedUser,
                role: "member",
                personId: T.linkedPerson,
            },
        });
        await db.organizationUser.create({
            data: { id: nanoId16(), organizationId: T.org, userId: T.unlinkedUser, role: "member" },
        });
    });

    function makeCaller(userId: UserId) {
        return skillsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: userId },
                permissions: { organization: ["view"], skillCheckSession: ["create"] },
                prisma: db,
            }),
        );
    }

    it("assigns the caller's linked person as the session's sole assessor", async () => {
        const { created } = await makeCaller(T.linkedUser).createSession({
            organizationId: T.org,
            skillCheckSessionId: SkillCheckSessionId.create(),
            create: {
                name: "Session A",
                date: new Date().toISOString(),
                notes: "",
                status: "Draft",
            },
        });

        expect(created.assessors).toEqual([{ id: T.linkedPerson, name: "Alice Anderson" }]);
    });

    it("throws BAD_REQUEST when the caller has no linked person record", async () => {
        await expect(
            makeCaller(T.unlinkedUser).createSession({
                organizationId: T.org,
                skillCheckSessionId: SkillCheckSessionId.create(),
                create: {
                    name: "Session B",
                    date: new Date().toISOString(),
                    notes: "",
                    status: "Draft",
                },
            }),
        ).rejects.toThrow(TRPCError);
    });
});

describe("skillsRouter.getPackage", () => {
    const T = {
        org: OrganizationId.create(),
        publisherOrg: OrganizationId.create(),
        user: nanoId16(),
        pkg: SkillPackageId.create(),
        unpublishedPkg: SkillPackageId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.organization.create({
            data: {
                id: T.publisherOrg,
                name: "Publisher",
                slug: "publisher",
                createdAt: new Date(),
            },
        });
        await db.skillPackage.create({
            data: {
                id: T.pkg,
                organizationId: T.publisherOrg,
                name: "Rescue Skills",
                description: "",
                properties: {},
                tags: [],
                published: true,
            },
        });
        await db.skillPackage.create({
            data: {
                id: T.unpublishedPkg,
                organizationId: T.publisherOrg,
                name: "Draft Skills",
                description: "",
                properties: {},
                tags: [],
                published: false,
            },
        });
        await db.skillPackageSubscription.create({
            data: {
                id: SkillPackageSubscriptionId.create(),
                organizationId: T.org,
                skillPackageId: T.pkg,
            },
        });
    });

    function makeCaller() {
        return skillsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { skillPackageSubscription: ["view"], organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("returns the package with subscription and counts for the caller's org", async () => {
        const result = await makeCaller().getPackage({
            organizationId: T.org,
            skillPackageId: T.pkg,
        });
        expect(result.id).toBe(T.pkg);
        expect(result.name).toBe("Rescue Skills");
        expect(result.organization.id).toBe(T.publisherOrg);
        expect(result.subscription).not.toBeNull();
        expect(result.subscriptionCount).toBe(1);
    });

    it("returns subscription: null when the org isn't subscribed", async () => {
        // A second org, never subscribed, requesting the same published package.
        const otherOrg = OrganizationId.create();
        await db.organization.create({
            data: { id: otherOrg, name: "Other", slug: "other", createdAt: new Date() },
        });
        const caller = skillsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { skillPackageSubscription: ["view"], organization: ["view"] },
                prisma: db,
            }),
        );
        const result = await caller.getPackage({
            organizationId: otherOrg,
            skillPackageId: T.pkg,
        });
        expect(result.subscription).toBeNull();
    });

    it("throws NOT_FOUND for an unpublished package", async () => {
        await expect(
            makeCaller().getPackage({ organizationId: T.org, skillPackageId: T.unpublishedPkg }),
        ).rejects.toThrow(/not found/i);
    });

    it("throws NOT_FOUND for an unknown package", async () => {
        await expect(
            makeCaller().getPackage({
                organizationId: T.org,
                skillPackageId: SkillPackageId.create(),
            }),
        ).rejects.toThrow(/not found/i);
    });
});
