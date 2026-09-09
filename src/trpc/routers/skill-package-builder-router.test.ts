/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

// skill-package-builder-router reaches @/server/auth at import time via ../init. The
// procedures under test only touch ctx.prisma (the injected mock), so stubbing
// server-only is enough to let the module load under jsdom.
vi.mock("server-only", () => ({}));

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { SkillId } from "@/lib/schemas/skill";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { skillPackageBuilderRouter } from "./skill-package-builder-router";

describe("skillPackageBuilderRouter.getPackage / getGroup / getSkill", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: nanoId16(),
        pkg: SkillPackageId.create(),
        otherOrgPkg: SkillPackageId.create(),
        group: SkillGroupId.create(),
        skill: SkillId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.organization.create({
            data: { id: T.otherOrg, name: "Other", slug: "other", createdAt: new Date() },
        });
        await db.skillPackage.create({
            data: {
                id: T.pkg,
                organizationId: T.org,
                name: "Rescue Skills",
                description: "",
                properties: {},
                tags: [],
            },
        });
        await db.skillPackage.create({
            data: {
                id: T.otherOrgPkg,
                organizationId: T.otherOrg,
                name: "Other Org Package",
                description: "",
                properties: {},
                tags: [],
            },
        });
        await db.skillGroup.create({
            data: {
                id: T.group,
                skillPackageId: T.pkg,
                name: "Rope Access",
                description: "",
                properties: {},
                tags: [],
                sequence: 1,
            },
        });
        await db.skill.create({
            data: {
                id: T.skill,
                skillPackageId: T.pkg,
                skillGroupId: T.group,
                name: "Tie a Bowline",
                description: "",
                properties: {},
                tags: [],
                sequence: 1,
            },
        });
    });

    function makeCaller() {
        return skillPackageBuilderRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { skillPackageBuilder: ["view"], organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("getPackage returns the package", async () => {
        const result = await makeCaller().getPackage({
            organizationId: T.org,
            skillPackageId: T.pkg,
        });
        expect(result.id).toBe(T.pkg);
        expect(result.name).toBe("Rescue Skills");
    });

    it("getPackage throws NOT_FOUND for a package in another organization", async () => {
        await expect(
            makeCaller().getPackage({ organizationId: T.org, skillPackageId: T.otherOrgPkg }),
        ).rejects.toThrow(/not found/i);
    });

    it("getGroup returns the group with its parent package", async () => {
        const result = await makeCaller().getGroup({
            organizationId: T.org,
            skillGroupId: T.group,
        });
        expect(result.id).toBe(T.group);
        expect(result.skillPackage.id).toBe(T.pkg);
        expect(result.skillPackage.name).toBe("Rescue Skills");
    });

    it("getGroup throws NOT_FOUND for an unknown group", async () => {
        await expect(
            makeCaller().getGroup({ organizationId: T.org, skillGroupId: SkillGroupId.create() }),
        ).rejects.toThrow(/not found/i);
    });

    it("getSkill returns the skill with its parent group and package", async () => {
        const result = await makeCaller().getSkill({
            organizationId: T.org,
            skillId: T.skill,
        });
        expect(result.id).toBe(T.skill);
        expect(result.skillGroup.id).toBe(T.group);
        expect(result.skillPackage.id).toBe(T.pkg);
    });

    it("getSkill throws NOT_FOUND for an unknown skill", async () => {
        await expect(
            makeCaller().getSkill({ organizationId: T.org, skillId: SkillId.create() }),
        ).rejects.toThrow(/not found/i);
    });
});

describe("skillPackageBuilderRouter.reorderGroups", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        pkg: SkillPackageId.create(),
        groupA: SkillGroupId.create(),
        groupB: SkillGroupId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.skillPackage.create({
            data: {
                id: T.pkg,
                organizationId: T.org,
                name: "Rescue Skills",
                description: "",
                properties: {},
                tags: [],
            },
        });
        for (const [id, sequence] of [
            [T.groupA, 1],
            [T.groupB, 2],
        ] as const) {
            await db.skillGroup.create({
                data: {
                    id,
                    skillPackageId: T.pkg,
                    name: `Group ${sequence}`,
                    description: "",
                    properties: {},
                    tags: [],
                    sequence,
                },
            });
        }
    });

    function makeCaller() {
        return skillPackageBuilderRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { skillPackageBuilder: ["update"], organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("writes nothing when the order is unchanged", async () => {
        await makeCaller().reorderGroups({
            organizationId: T.org,
            skillPackageId: T.pkg,
            newOrder: [T.groupA, T.groupB],
        });

        expect(await db.logEntry.count()).toBe(0);
    });

    it("writes one entry against the package, not one per group", async () => {
        await makeCaller().reorderGroups({
            organizationId: T.org,
            skillPackageId: T.pkg,
            newOrder: [T.groupB, T.groupA],
        });

        const entries = await db.logEntry.findMany({
            where: { organizationId: T.org },
        });

        expect(entries).toHaveLength(1);
        expect(entries[0].objectType).toBe("SkillPackage");
        expect(entries[0].objectId).toBe(T.pkg);
        expect(entries[0].changes).toEqual([
            {
                type: "arr_ord",
                path: ["groups"],
                prev: [T.groupA, T.groupB],
                curr: [T.groupB, T.groupA],
            },
        ]);
    });

    it("drops an ID that is not a child of the package from the recorded curr", async () => {
        // At this point sequences are groupB=1, groupA=2 from the previous test.
        const foreignGroupId = SkillGroupId.create();

        await makeCaller().reorderGroups({
            organizationId: T.org,
            skillPackageId: T.pkg,
            newOrder: [foreignGroupId, T.groupA, T.groupB],
        });

        const entries = await db.logEntry.findMany({
            where: { organizationId: T.org },
        });

        expect(entries).toHaveLength(2);
        const latest = entries[entries.length - 1];

        expect(latest.changes).toEqual([
            {
                type: "arr_ord",
                path: ["groups"],
                prev: [T.groupB, T.groupA],
                curr: [T.groupA, T.groupB],
            },
        ]);
        expect(JSON.stringify(latest.changes)).not.toContain(foreignGroupId);
    });
});

describe("skillPackageBuilderRouter.reorderGroupSkills", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        pkg: SkillPackageId.create(),
        group: SkillGroupId.create(),
        skillA: SkillId.create(),
        skillB: SkillId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.skillPackage.create({
            data: {
                id: T.pkg,
                organizationId: T.org,
                name: "Rescue Skills",
                description: "",
                properties: {},
                tags: [],
            },
        });
        await db.skillGroup.create({
            data: {
                id: T.group,
                skillPackageId: T.pkg,
                name: "Rope Access",
                description: "",
                properties: {},
                tags: [],
                sequence: 1,
            },
        });
        for (const [id, sequence] of [
            [T.skillA, 1],
            [T.skillB, 2],
        ] as const) {
            await db.skill.create({
                data: {
                    id,
                    skillPackageId: T.pkg,
                    skillGroupId: T.group,
                    name: `Skill ${sequence}`,
                    description: "",
                    properties: {},
                    tags: [],
                    sequence,
                },
            });
        }
    });

    function makeCaller() {
        return skillPackageBuilderRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { skillPackageBuilder: ["update"], organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("writes nothing when the order is unchanged", async () => {
        await makeCaller().reorderGroupSkills({
            organizationId: T.org,
            skillGroupId: T.group,
            newOrder: [T.skillA, T.skillB],
        });

        expect(await db.logEntry.count()).toBe(0);
    });

    it("writes one entry against the group, not one per skill", async () => {
        await makeCaller().reorderGroupSkills({
            organizationId: T.org,
            skillGroupId: T.group,
            newOrder: [T.skillB, T.skillA],
        });

        const entries = await db.logEntry.findMany({
            where: { organizationId: T.org },
        });

        expect(entries).toHaveLength(1);
        expect(entries[0].objectType).toBe("SkillGroup");
        expect(entries[0].objectId).toBe(T.group);
        expect(entries[0].changes).toEqual([
            {
                type: "arr_ord",
                path: ["skills"],
                prev: [T.skillA, T.skillB],
                curr: [T.skillB, T.skillA],
            },
        ]);
    });
});
