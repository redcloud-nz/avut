/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import type { Permissions } from "@/lib/permissions";
import { OrganizationId } from "@/lib/schemas/organization";
import { SkillId } from "@/lib/schemas/skill";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { SkillPackageSubscriptionId } from "@/lib/schemas/skill-package-subscription";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { skillPackageSubscriptionsRouter } from "./skill-package-subscriptions-router";

describe("skillPackageSubscriptions.getPackage", () => {
    const T = {
        org: OrganizationId.create(),
        publisherOrg: OrganizationId.create(),
        user: UserId.create(),
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

    it("keeps the catalogue contents payload to the picked fields", async () => {
        const result = await makeCaller().getPackage({
            organizationId: T.org,
            skillPackageId: T.contentsPkg,
        });

        expect(result.groups[0]).not.toHaveProperty("properties");
        expect(result.groups[0]).not.toHaveProperty("createdAt");
        expect(result.groups[0].skills[0]).not.toHaveProperty("properties");
        expect(result.groups[0].skills[0]).not.toHaveProperty("frequency");
    });

    it("throws NOT_FOUND for an unpublished package the org doesn't subscribe to", async () => {
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

describe("skillPackageSubscriptionsRouter shows a Deleted package to its subscribers as withdrawn", () => {
    const T = {
        org: OrganizationId.create(),
        publisherOrg: OrganizationId.create(),
        user: UserId.create(),
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

    it("getPackage returns it to a subscriber", async () => {
        const result = await makeCaller().getPackage({
            organizationId: T.org,
            skillPackageId: T.deletedPkg,
        });

        expect(result.status).toBe("Deleted");
        expect(result.subscription).not.toBeNull();
    });

    it("getPackage throws NOT_FOUND to a non-subscriber", async () => {
        await expect(
            makeCaller().getPackage({
                organizationId: T.org,
                skillPackageId: T.unsubscribedDeletedPkg,
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("listPackages shows a subscriber its Deleted package, but not a non-subscriber", async () => {
        const ids = (await makeCaller().listPackages({ organizationId: T.org })).map((p) => p.id);
        expect(ids.sort()).toEqual([T.livePkg, T.deletedPkg].sort());
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

    // Last: it removes the subscription the tests above read.
    it("unsubscribeFromPackage lets a subscriber leave it", async () => {
        await makeCaller().unsubscribeFromPackage({
            organizationId: T.org,
            skillPackageId: T.deletedPkg,
        });

        const ids = (await makeCaller().listPackages({ organizationId: T.org })).map((p) => p.id);
        expect(ids).toEqual([T.livePkg]);
    });
});

describe("skillPackageSubscriptionsRouter withholds a withdrawn package from its subscribers", () => {
    const T = {
        org: OrganizationId.create(),
        // Subscribes to nothing.
        otherOrg: OrganizationId.create(),
        publisherOrg: OrganizationId.create(),
        user: UserId.create(),
        livePkg: SkillPackageId.create(),
        unpublishedPkg: SkillPackageId.create(),
        archivedPkg: SkillPackageId.create(),
        // Archived before archivePackage unpublished on archive, so still `published: true`.
        unsubscribedArchivedPkg: SkillPackageId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const [id, slug] of [
            [T.org, "acme"],
            [T.otherOrg, "other"],
            [T.publisherOrg, "publisher"],
        ] as const) {
            await db.organization.create({
                data: { id, name: slug, slug, createdAt: new Date() },
            });
        }
        for (const [id, published, status] of [
            [T.livePkg, true, "Active"],
            [T.unpublishedPkg, false, "Active"],
            [T.archivedPkg, false, "Archived"],
            [T.unsubscribedArchivedPkg, true, "Archived"],
        ] as const) {
            await db.skillPackage.create({
                data: {
                    id,
                    organizationId: T.publisherOrg,
                    name: id,
                    description: "",
                    properties: {},
                    tags: [],
                    published,
                    status,
                },
            });
        }
        for (const skillPackageId of [T.livePkg, T.unpublishedPkg, T.archivedPkg]) {
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

    it("listSubscribedPackages leaves out the unpublished and the Archived package", async () => {
        const subscribed = await makeCaller().listSubscribedPackages({ organizationId: T.org });
        expect(subscribed.map((p) => p.id)).toEqual([T.livePkg]);
    });

    it("listAssessableSkills leaves out the unpublished and the Archived package", async () => {
        const { skillPackages } = await makeCaller().listAssessableSkills({
            organizationId: T.org,
        });
        expect(skillPackages.map((p) => p.id)).toEqual([T.livePkg]);
    });

    it("listPackages shows a subscriber its withdrawn packages, but not a non-subscriber", async () => {
        const forSubscriber = await makeCaller().listPackages({ organizationId: T.org });
        expect(forSubscriber.map((p) => p.id).sort()).toEqual(
            [T.livePkg, T.unpublishedPkg, T.archivedPkg].sort(),
        );

        const forOther = await makeCaller().listPackages({ organizationId: T.otherOrg });
        expect(forOther.map((p) => p.id)).toEqual([T.livePkg]);
    });

    it("getPackage returns an unpublished package to a subscriber", async () => {
        const result = await makeCaller().getPackage({
            organizationId: T.org,
            skillPackageId: T.unpublishedPkg,
        });
        expect(result.id).toBe(T.unpublishedPkg);
        expect(result.published).toBe(false);
        expect(result.subscription).not.toBeNull();
    });

    it("getPackage throws NOT_FOUND for an unpublished package to a non-subscriber", async () => {
        await expect(
            makeCaller().getPackage({
                organizationId: T.otherOrg,
                skillPackageId: T.unpublishedPkg,
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("subscribeToPackage throws NOT_FOUND for an Archived package that is still published", async () => {
        await expect(
            makeCaller().subscribeToPackage({
                organizationId: T.org,
                skillPackageId: T.unsubscribedArchivedPkg,
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
});

describe("skillPackageSubscriptions.getSkill", () => {
    const T = {
        org: OrganizationId.create(),
        publisherOrg: OrganizationId.create(),
        user: UserId.create(),
        // Published and Active, subscribed by T.org.
        livePkg: SkillPackageId.create(),
        liveGroup: SkillGroupId.create(),
        liveSkill: SkillId.create(),
        archivedSkill: SkillId.create(),
        deletedSkill: SkillId.create(),
        deletedGroup: SkillGroupId.create(),
        skillInDeletedGroup: SkillId.create(),
        // Published and Active, not subscribed.
        openPkg: SkillPackageId.create(),
        openSkill: SkillId.create(),
        // Unpublished, subscribed.
        withdrawnPkg: SkillPackageId.create(),
        withdrawnSkill: SkillId.create(),
        // Published but Archived, subscribed.
        archivedPkg: SkillPackageId.create(),
        archivedPkgSkill: SkillId.create(),
        // Unpublished, not subscribed.
        unsubscribedWithdrawnPkg: SkillPackageId.create(),
        unsubscribedWithdrawnSkill: SkillId.create(),
        // Deleted, still subscribed.
        deletedPkg: SkillPackageId.create(),
        deletedPkgSkill: SkillId.create(),
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

        // [package, published, status, subscribed, group, skill]: one group and skill each.
        for (const [skillPackageId, published, status, subscribed, skillGroupId, skillId] of [
            [T.livePkg, true, "Active", true, T.liveGroup, T.liveSkill],
            [T.openPkg, true, "Active", false, SkillGroupId.create(), T.openSkill],
            [T.withdrawnPkg, false, "Active", true, SkillGroupId.create(), T.withdrawnSkill],
            [T.archivedPkg, true, "Archived", true, SkillGroupId.create(), T.archivedPkgSkill],
            [
                T.unsubscribedWithdrawnPkg,
                false,
                "Active",
                false,
                SkillGroupId.create(),
                T.unsubscribedWithdrawnSkill,
            ],
            [T.deletedPkg, true, "Deleted", true, SkillGroupId.create(), T.deletedPkgSkill],
        ] as const) {
            await db.skillPackage.create({
                data: {
                    id: skillPackageId,
                    organizationId: T.publisherOrg,
                    name: `Package ${skillPackageId}`,
                    description: "",
                    properties: {},
                    tags: [],
                    published,
                    status,
                },
            });
            if (subscribed) {
                await db.skillPackageSubscription.create({
                    data: {
                        id: SkillPackageSubscriptionId.create(),
                        organizationId: T.org,
                        skillPackageId,
                    },
                });
            }
            await db.skillGroup.create({
                data: {
                    id: skillGroupId,
                    skillPackageId,
                    name: "Group",
                    description: "",
                    properties: {},
                    tags: [],
                    sequence: 0,
                },
            });
            await db.skill.create({
                data: {
                    id: skillId,
                    skillPackageId,
                    skillGroupId,
                    name: `Skill ${skillId}`,
                    description: "",
                    properties: {},
                    tags: ["tag"],
                    sequence: 0,
                },
            });
        }

        for (const [id, status] of [
            [T.archivedSkill, "Archived"],
            [T.deletedSkill, "Deleted"],
        ] as const) {
            await db.skill.create({
                data: {
                    id,
                    skillPackageId: T.livePkg,
                    skillGroupId: T.liveGroup,
                    name: `Skill ${id}`,
                    description: "",
                    properties: {},
                    tags: [],
                    sequence: 1,
                    status,
                },
            });
        }

        // deleteGroup doesn't cascade, so an Active skill can sit in a Deleted group.
        await db.skillGroup.create({
            data: {
                id: T.deletedGroup,
                skillPackageId: T.livePkg,
                name: "Deleted Group",
                description: "",
                properties: {},
                tags: [],
                sequence: 1,
                status: "Deleted",
            },
        });
        await db.skill.create({
            data: {
                id: T.skillInDeletedGroup,
                skillPackageId: T.livePkg,
                skillGroupId: T.deletedGroup,
                name: "Skill in a Deleted group",
                description: "",
                properties: {},
                tags: [],
                sequence: 0,
            },
        });
    });

    function makeCaller(permissions: Permissions = { skillPackageSubscription: ["view"] }) {
        return skillPackageSubscriptionsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { ...permissions, organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("returns a skill in a subscribed, available package with its group and package", async () => {
        const result = await makeCaller().getSkill({ organizationId: T.org, skillId: T.liveSkill });

        expect(result.id).toBe(T.liveSkill);
        expect(result.tags).toEqual(["tag"]);
        expect(result.group?.id).toBe(T.liveGroup);
        expect(result.skillPackage.id).toBe(T.livePkg);
        expect(result.subscribed).toBe(true);
    });

    it("returns a skill in an available package the org doesn't subscribe to", async () => {
        const result = await makeCaller().getSkill({ organizationId: T.org, skillId: T.openSkill });

        expect(result.id).toBe(T.openSkill);
        expect(result.subscribed).toBe(false);
    });

    it("returns a skill in a withdrawn package the org subscribes to", async () => {
        const result = await makeCaller().getSkill({
            organizationId: T.org,
            skillId: T.withdrawnSkill,
        });

        expect(result.id).toBe(T.withdrawnSkill);
        expect(result.skillPackage.published).toBe(false);
        expect(result.subscribed).toBe(true);
    });

    it("returns a skill in a published but Archived package the org subscribes to", async () => {
        const result = await makeCaller().getSkill({
            organizationId: T.org,
            skillId: T.archivedPkgSkill,
        });

        expect(result.id).toBe(T.archivedPkgSkill);
        expect(result.skillPackage.published).toBe(true);
        expect(result.skillPackage.status).toBe("Archived");
        expect(result.subscribed).toBe(true);
    });

    it("throws NOT_FOUND for a skill in a withdrawn package the org doesn't subscribe to", async () => {
        await expect(
            makeCaller().getSkill({
                organizationId: T.org,
                skillId: T.unsubscribedWithdrawnSkill,
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("returns a skill in a Deleted package the org still subscribes to", async () => {
        const result = await makeCaller().getSkill({
            organizationId: T.org,
            skillId: T.deletedPkgSkill,
        });

        expect(result.skillPackage.status).toBe("Deleted");
        expect(result.subscribed).toBe(true);
    });

    it("returns an Archived skill", async () => {
        const result = await makeCaller().getSkill({
            organizationId: T.org,
            skillId: T.archivedSkill,
        });

        expect(result.status).toBe("Archived");
    });

    it("throws NOT_FOUND for an Active skill in a Deleted group", async () => {
        await expect(
            makeCaller().getSkill({ organizationId: T.org, skillId: T.skillInDeletedGroup }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("listAssessableSkills leaves out an Active skill in a Deleted group, and the group", async () => {
        const { skillGroups, skills } = await makeCaller().listAssessableSkills({
            organizationId: T.org,
        });

        expect(skills.map((s) => s.id)).toContain(T.liveSkill);
        expect(skills.map((s) => s.id)).not.toContain(T.skillInDeletedGroup);
        expect(skillGroups.map((g) => g.id)).not.toContain(T.deletedGroup);
    });

    it("throws NOT_FOUND for a Deleted skill", async () => {
        await expect(
            makeCaller().getSkill({ organizationId: T.org, skillId: T.deletedSkill }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("is forbidden without skillPackageSubscription:view permission", async () => {
        await expect(
            makeCaller({}).getSkill({ organizationId: T.org, skillId: T.liveSkill }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
});

describe("skillPackageSubscriptions.getGroup", () => {
    const T = {
        org: OrganizationId.create(),
        publisherOrg: OrganizationId.create(),
        user: UserId.create(),
        // Published and Active, subscribed by T.org.
        livePkg: SkillPackageId.create(),
        liveGroup: SkillGroupId.create(),
        archivedGroup: SkillGroupId.create(),
        deletedGroup: SkillGroupId.create(),
        firstSkill: SkillId.create(),
        archivedSkill: SkillId.create(),
        deletedSkill: SkillId.create(),
        // Published and Active, not subscribed.
        openPkg: SkillPackageId.create(),
        openGroup: SkillGroupId.create(),
        // Unpublished, subscribed.
        withdrawnPkg: SkillPackageId.create(),
        withdrawnGroup: SkillGroupId.create(),
        // Unpublished, not subscribed.
        unsubscribedWithdrawnPkg: SkillPackageId.create(),
        unsubscribedWithdrawnGroup: SkillGroupId.create(),
        // Deleted, still subscribed.
        deletedPkg: SkillPackageId.create(),
        deletedPkgGroup: SkillGroupId.create(),
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

        // [package, published, status, subscribed, group]: one Active group each.
        for (const [skillPackageId, published, status, subscribed, skillGroupId] of [
            [T.livePkg, true, "Active", true, T.liveGroup],
            [T.openPkg, true, "Active", false, T.openGroup],
            [T.withdrawnPkg, false, "Active", true, T.withdrawnGroup],
            [T.unsubscribedWithdrawnPkg, false, "Active", false, T.unsubscribedWithdrawnGroup],
            [T.deletedPkg, true, "Deleted", true, T.deletedPkgGroup],
        ] as const) {
            await db.skillPackage.create({
                data: {
                    id: skillPackageId,
                    organizationId: T.publisherOrg,
                    name: `Package ${skillPackageId}`,
                    description: "",
                    properties: {},
                    tags: [],
                    published,
                    status,
                },
            });
            if (subscribed) {
                await db.skillPackageSubscription.create({
                    data: {
                        id: SkillPackageSubscriptionId.create(),
                        organizationId: T.org,
                        skillPackageId,
                    },
                });
            }
            await db.skillGroup.create({
                data: {
                    id: skillGroupId,
                    skillPackageId,
                    name: `Group ${skillGroupId}`,
                    description: "",
                    properties: {},
                    tags: ["tag"],
                    sequence: 0,
                },
            });
        }

        for (const [id, status, sequence] of [
            [T.archivedGroup, "Archived", 1],
            [T.deletedGroup, "Deleted", 2],
        ] as const) {
            await db.skillGroup.create({
                data: {
                    id,
                    skillPackageId: T.livePkg,
                    name: `Group ${id}`,
                    description: "",
                    properties: {},
                    tags: [],
                    sequence,
                    status,
                },
            });
        }

        // Created out of sequence order, to check the ordering.
        for (const [id, status, sequence] of [
            [T.archivedSkill, "Archived", 2],
            [T.deletedSkill, "Deleted", 1],
            [T.firstSkill, "Active", 0],
        ] as const) {
            await db.skill.create({
                data: {
                    id,
                    skillPackageId: T.livePkg,
                    skillGroupId: T.liveGroup,
                    name: `Skill ${id}`,
                    description: "",
                    properties: {},
                    tags: [],
                    sequence,
                    status,
                },
            });
        }
    });

    function makeCaller(permissions: Permissions = { skillPackageSubscription: ["view"] }) {
        return skillPackageSubscriptionsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { ...permissions, organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("returns a group in a subscribed, available package with its package", async () => {
        const result = await makeCaller().getGroup({
            organizationId: T.org,
            skillPackageId: T.livePkg,
            skillGroupId: T.liveGroup,
        });

        expect(result.id).toBe(T.liveGroup);
        expect(result.tags).toEqual(["tag"]);
        expect(result.skillPackage.id).toBe(T.livePkg);
        expect(result.subscribed).toBe(true);
    });

    it("lists Archived skills and leaves out Deleted ones, in sequence order", async () => {
        const result = await makeCaller().getGroup({
            organizationId: T.org,
            skillPackageId: T.livePkg,
            skillGroupId: T.liveGroup,
        });

        expect(result.skills.map((skill) => skill.id)).toEqual([T.firstSkill, T.archivedSkill]);
        expect(result.skills[1].status).toBe("Archived");
    });

    it("returns a group in an available package the org doesn't subscribe to", async () => {
        const result = await makeCaller().getGroup({
            organizationId: T.org,
            skillPackageId: T.openPkg,
            skillGroupId: T.openGroup,
        });

        expect(result.id).toBe(T.openGroup);
        expect(result.subscribed).toBe(false);
    });

    it("returns a group in a withdrawn package the org subscribes to", async () => {
        const result = await makeCaller().getGroup({
            organizationId: T.org,
            skillPackageId: T.withdrawnPkg,
            skillGroupId: T.withdrawnGroup,
        });

        expect(result.id).toBe(T.withdrawnGroup);
        expect(result.skillPackage.published).toBe(false);
        expect(result.subscribed).toBe(true);
    });

    it("throws NOT_FOUND for a group in a withdrawn package the org doesn't subscribe to", async () => {
        await expect(
            makeCaller().getGroup({
                organizationId: T.org,
                skillPackageId: T.unsubscribedWithdrawnPkg,
                skillGroupId: T.unsubscribedWithdrawnGroup,
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("returns a group in a Deleted package the org still subscribes to", async () => {
        const result = await makeCaller().getGroup({
            organizationId: T.org,
            skillPackageId: T.deletedPkg,
            skillGroupId: T.deletedPkgGroup,
        });

        expect(result.skillPackage.status).toBe("Deleted");
        expect(result.subscribed).toBe(true);
    });

    it("returns an Archived group", async () => {
        const result = await makeCaller().getGroup({
            organizationId: T.org,
            skillPackageId: T.livePkg,
            skillGroupId: T.archivedGroup,
        });

        expect(result.status).toBe("Archived");
    });

    it("throws NOT_FOUND for a Deleted group", async () => {
        await expect(
            makeCaller().getGroup({
                organizationId: T.org,
                skillPackageId: T.livePkg,
                skillGroupId: T.deletedGroup,
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("throws NOT_FOUND for a group id paired with a different package id", async () => {
        await expect(
            makeCaller().getGroup({
                organizationId: T.org,
                skillPackageId: T.openPkg,
                skillGroupId: T.liveGroup,
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("is forbidden without skillPackageSubscription:view permission", async () => {
        await expect(
            makeCaller({}).getGroup({
                organizationId: T.org,
                skillPackageId: T.livePkg,
                skillGroupId: T.liveGroup,
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
});
