/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { TRPCError } from "@trpc/server";

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillGroupId } from "@/lib/schemas/skill-group";
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
                permissions: { organization: ["view"], skillCheckSession: ["create", "view"] },
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

    it("assigns sequential session numbers within the organization", async () => {
        const { created: first } = await makeCaller(T.linkedUser).createSession({
            organizationId: T.org,
            skillCheckSessionId: SkillCheckSessionId.create(),
            create: {
                name: "Session C",
                date: new Date().toISOString(),
                notes: "",
                status: "Draft",
            },
        });
        const { created: second } = await makeCaller(T.linkedUser).createSession({
            organizationId: T.org,
            skillCheckSessionId: SkillCheckSessionId.create(),
            create: {
                name: "Session D",
                date: new Date().toISOString(),
                notes: "",
                status: "Draft",
            },
        });

        expect(second.sessionNumber).toBe(first.sessionNumber + 1);
    });

    it("defaults the name to Session #N when no name is given", async () => {
        const { nextSessionNumber } = await makeCaller(T.linkedUser).nextSessionNumber({
            organizationId: T.org,
        });

        const { created } = await makeCaller(T.linkedUser).createSession({
            organizationId: T.org,
            skillCheckSessionId: SkillCheckSessionId.create(),
            create: { name: "", date: new Date().toISOString(), notes: "", status: "Draft" },
        });

        expect(created.name).toBe(`Session #${nextSessionNumber}`);
        expect(created.sessionNumber).toBe(nextSessionNumber);
    });

    it("assigns the next available number when a race leaves the computed number taken", async () => {
        const { nextSessionNumber } = await makeCaller(T.linkedUser).nextSessionNumber({
            organizationId: T.org,
        });

        // Simulate a concurrent create claiming the number that would otherwise be computed next.
        await db.skillCheckSession.create({
            data: {
                id: SkillCheckSessionId.create(),
                organizationId: T.org,
                name: "Snuck in first",
                sessionNumber: nextSessionNumber,
                status: "Draft",
            },
        });

        const { created } = await makeCaller(T.linkedUser).createSession({
            organizationId: T.org,
            skillCheckSessionId: SkillCheckSessionId.create(),
            create: {
                name: "Session E",
                date: new Date().toISOString(),
                notes: "",
                status: "Draft",
            },
        });

        expect(created.sessionNumber).toBe(nextSessionNumber + 1);
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

    it("returns groups and skills ordered by sequence with their default flags", async () => {
        const pkg = SkillPackageId.create();
        const groupA = SkillGroupId.create();
        const groupB = SkillGroupId.create();
        await db.skillPackage.create({
            data: {
                id: pkg,
                organizationId: T.publisherOrg,
                name: "Contents Pkg",
                description: "",
                properties: {},
                tags: [],
                published: true,
            },
        });
        await db.skillGroup.create({
            data: {
                id: groupB,
                skillPackageId: pkg,
                name: "Group B",
                description: "",
                properties: {},
                tags: [],
                sequence: 1,
                defaultInclude: false,
            },
        });
        await db.skillGroup.create({
            data: {
                id: groupA,
                skillPackageId: pkg,
                name: "Group A",
                description: "",
                properties: {},
                tags: [],
                sequence: 0,
            },
        });
        await db.skill.create({
            data: {
                id: SkillId.create(),
                skillPackageId: pkg,
                skillGroupId: groupA,
                name: "Skill A2",
                description: "",
                properties: {},
                tags: [],
                sequence: 1,
                defaultRequired: true,
            },
        });
        await db.skill.create({
            data: {
                id: SkillId.create(),
                skillPackageId: pkg,
                skillGroupId: groupA,
                name: "Skill A1",
                description: "",
                properties: {},
                tags: [],
                sequence: 0,
                defaultInclude: false,
            },
        });

        const result = await makeCaller().getPackage({
            organizationId: T.org,
            skillPackageId: pkg,
        });

        expect(result.groups.map((g) => g.name)).toEqual(["Group A", "Group B"]);
        expect(result.groups[1].defaultInclude).toBe(false);
        expect(result.skills.map((s) => s.name)).toEqual(["Skill A1", "Skill A2"]);
        expect(result.skills[0].defaultInclude).toBe(false);
        expect(result.skills[1].defaultRequired).toBe(true);
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
