/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { SkillId } from "@/lib/schemas/skill";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { SkillPackageSubscriptionId } from "@/lib/schemas/skill-package-subscription";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { skillPackageSubscriptionsRouter } from "./skill-package-subscriptions-router";

describe("skillPackageSubscriptions.getPackage", () => {
    const T = {
        org: OrganizationId.create(),
        publisherOrg: OrganizationId.create(),
        user: nanoId16(),
        pkg: SkillPackageId.create(),
        unpublishedPkg: SkillPackageId.create(),
        // Package used for the contents assertions:
        //   groupA (seq 0)         → skillA1 (seq 0, not included), skillA2 (seq 1, required)
        //   groupB (seq 1, not included by default) → no skills
        //   archivedGroup (Archived) → archivedGroupSkill (still Active — archiveGroup doesn't cascade)
        contentsPkg: SkillPackageId.create(),
        groupA: SkillGroupId.create(),
        groupB: SkillGroupId.create(),
        archivedGroup: SkillGroupId.create(),
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

        await db.skillPackage.create({
            data: {
                id: T.contentsPkg,
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
                id: T.groupB,
                skillPackageId: T.contentsPkg,
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
                id: T.groupA,
                skillPackageId: T.contentsPkg,
                name: "Group A",
                description: "",
                properties: {},
                tags: [],
                sequence: 0,
            },
        });
        await db.skillGroup.create({
            data: {
                id: T.archivedGroup,
                skillPackageId: T.contentsPkg,
                name: "Archived Group",
                description: "",
                properties: {},
                tags: [],
                sequence: 2,
                status: "Archived",
            },
        });
        await db.skill.create({
            data: {
                id: SkillId.create(),
                skillPackageId: T.contentsPkg,
                skillGroupId: T.groupA,
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
                skillPackageId: T.contentsPkg,
                skillGroupId: T.groupA,
                name: "Skill A1",
                description: "",
                properties: {},
                tags: [],
                sequence: 0,
                defaultInclude: false,
            },
        });
        // Active skill whose parent group is Archived — must not surface or be counted.
        await db.skill.create({
            data: {
                id: SkillId.create(),
                skillPackageId: T.contentsPkg,
                skillGroupId: T.archivedGroup,
                name: "Orphan Skill",
                description: "",
                properties: {},
                tags: [],
                sequence: 0,
            },
        });
    });

    function makeCaller() {
        return skillPackageSubscriptionsRouter.createCaller(
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
        const caller = skillPackageSubscriptionsRouter.createCaller(
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

    it("returns groups and their skills ordered by sequence with default flags", async () => {
        const result = await makeCaller().getPackage({
            organizationId: T.org,
            skillPackageId: T.contentsPkg,
        });

        expect(result.groups.map((g) => g.name)).toEqual(["Group A", "Group B"]);
        expect(result.groups[1].defaultInclude).toBe(false);

        const [groupA, groupB] = result.groups;
        expect(groupA.skills.map((s) => s.name)).toEqual(["Skill A1", "Skill A2"]);
        expect(groupA.skills[0].defaultInclude).toBe(false);
        expect(groupA.skills[1].defaultRequired).toBe(true);
        expect(groupB.skills).toEqual([]);
    });

    it("excludes archived groups and their still-active skills, and doesn't count them", async () => {
        const result = await makeCaller().getPackage({
            organizationId: T.org,
            skillPackageId: T.contentsPkg,
        });

        expect(result.groups.map((g) => g.name)).not.toContain("Archived Group");
        expect(result.groups.flatMap((g) => g.skills.map((s) => s.name))).not.toContain(
            "Orphan Skill",
        );
        expect(result.skillCount).toBe(2);
    });

    it("doesn't leak properties/tags/timestamps on catalogue groups and skills", async () => {
        const result = await makeCaller().getPackage({
            organizationId: T.org,
            skillPackageId: T.contentsPkg,
        });

        expect(result.groups[0]).not.toHaveProperty("properties");
        expect(result.groups[0]).not.toHaveProperty("createdAt");
        expect(result.groups[0].skills[0]).not.toHaveProperty("properties");
        expect(result.groups[0].skills[0]).not.toHaveProperty("frequency");
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

describe("skillPackageSubscriptionsRouter catalogue hides a Deleted package", () => {
    const T = {
        org: OrganizationId.create(),
        publisherOrg: OrganizationId.create(),
        user: nanoId16(),
        livePkg: SkillPackageId.create(),
        // Deleted before deletePackage unpublished on delete, so still `published: true`.
        deletedPkg: SkillPackageId.create(),
        unsubscribedDeletedPkg: SkillPackageId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const [id, slug] of [
            [T.org, "acme"],
            [T.publisherOrg, "publisher"],
        ] as const) {
            await db.organization.create({
                data: { id, name: slug, slug, createdAt: new Date() },
            });
        }
        for (const [id, status] of [
            [T.livePkg, "Active"],
            [T.deletedPkg, "Deleted"],
            [T.unsubscribedDeletedPkg, "Deleted"],
        ] as const) {
            await db.skillPackage.create({
                data: {
                    id,
                    organizationId: T.publisherOrg,
                    name: id,
                    description: "",
                    properties: {},
                    tags: [],
                    published: true,
                    status,
                },
            });
        }
        for (const skillPackageId of [T.livePkg, T.deletedPkg]) {
            await db.skillPackageSubscription.create({
                data: {
                    id: SkillPackageSubscriptionId.create(),
                    organizationId: T.org,
                    skillPackageId,
                },
            });
        }
    });

    function makeCaller() {
        return skillPackageSubscriptionsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: {
                    skillPackageSubscription: ["view", "subscribe"],
                    organization: ["view"],
                },
                prisma: db,
            }),
        );
    }

    it("getPackage throws NOT_FOUND", async () => {
        await expect(
            makeCaller().getPackage({ organizationId: T.org, skillPackageId: T.deletedPkg }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("listPackages leaves it out", async () => {
        const ids = (await makeCaller().listPackages({ organizationId: T.org })).map((p) => p.id);
        expect(ids).toEqual([T.livePkg]);
    });

    it("listSubscribedPackages and listAssessableSkills leave it out", async () => {
        const subscribed = await makeCaller().listSubscribedPackages({ organizationId: T.org });
        expect(subscribed.map((p) => p.id)).toEqual([T.livePkg]);

        const { skillPackages } = await makeCaller().listAssessableSkills({
            organizationId: T.org,
        });
        expect(skillPackages.map((p) => p.id)).toEqual([T.livePkg]);
    });

    it("subscribeToPackage throws NOT_FOUND", async () => {
        await expect(
            makeCaller().subscribeToPackage({
                organizationId: T.org,
                skillPackageId: T.unsubscribedDeletedPkg,
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
});
