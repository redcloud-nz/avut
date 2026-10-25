/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { nanoId16 } from "@/lib/id";
import type { Permissions } from "@/lib/permissions";
import { OrganizationId } from "@/lib/schemas/organization";
import { SkillId } from "@/lib/schemas/skill";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import {
    SKILL_PACKAGE_EXPORT_FORMAT_VERSION,
    type SkillPackageExport,
} from "@/lib/schemas/skill-package-export";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { skillPackageBuilderRouter } from "./skill-package-builder-router";

// skill-package-builder-router reaches @/server/auth at import time via ../init. The
// procedures under test only touch ctx.prisma (the injected mock), so stubbing
// server-only is enough to let the module load under jsdom.
vi.mock("server-only", () => ({}));

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
                permissions: { skillPackage: ["view"], organization: ["view"] },
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

describe("skillPackageBuilderRouter.importPackage", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: nanoId16(),
    };
    const db = createMockPrisma();

    function makeEnvelope(): SkillPackageExport {
        return {
            formatVersion: SKILL_PACKAGE_EXPORT_FORMAT_VERSION,
            exportedAt: new Date().toISOString(),
            package: {
                id: SkillPackageId.create(),
                name: "Starter Package",
                description: "A starter package for tests.",
                tags: [],
                properties: {},
                groups: [
                    {
                        id: SkillGroupId.create(),
                        name: "Group 1",
                        description: "",
                        tags: [],
                        properties: {},
                        sequence: 0,
                        defaultInclude: true,
                        skills: [
                            {
                                id: SkillId.create(),
                                name: "Skill 1",
                                description: "",
                                tags: [],
                                properties: {},
                                sequence: 0,
                                frequency: 12,
                                defaultInclude: true,
                                defaultRequired: true,
                            },
                        ],
                    },
                ],
            },
        };
    }

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: `acme-${nanoId16()}`, createdAt: new Date() },
        });
        await db.organization.create({
            data: {
                id: T.otherOrg,
                name: "Other",
                slug: `other-${nanoId16()}`,
                createdAt: new Date(),
            },
        });
    });

    function makeCaller(
        permissions: Permissions = { skillPackage: ["create"], organization: ["view"] },
    ) {
        return skillPackageBuilderRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions,
                prisma: db,
            }),
        );
    }

    it("dryRun computes a plan without writing", async () => {
        const result = await makeCaller().importPackage({
            organizationId: T.org,
            envelope: makeEnvelope(),
            dryRun: true,
        });
        expect(result.applied).toBe(false);
        expect(result.plan.packageAction).toBe("Create");
        expect(await db.skillPackage.findMany({ where: { organizationId: T.org } })).toHaveLength(
            0,
        );
    });

    it("imports the tree unpublished into the caller's organization, one log entry per created row", async () => {
        const result = await makeCaller().importPackage({
            organizationId: T.org,
            envelope: makeEnvelope(),
            dryRun: false,
        });
        expect(result.applied).toBe(true);

        const stored = await db.skillPackage.findUnique({
            where: { id: result.plan.package.id },
            include: { groups: true, skills: true },
        });
        expect(stored?.organizationId).toBe(T.org);
        expect(stored?.published).toBe(false);
        expect(stored?.groups.length).toBeGreaterThan(0);
        expect(stored?.skills.length).toBeGreaterThan(0);

        const packageEntries = await db.logEntry.findMany({
            where: { objectType: "SkillPackage", objectId: result.plan.package.id },
        });
        expect(packageEntries).toHaveLength(1);
        expect(packageEntries[0]).toMatchObject({
            scope: "organization",
            organizationId: T.org,
            action: "Create",
        });

        // One entry per package/group/skill row, all correlated by one batch.
        const allEntries = await db.logEntry.findMany({
            where: { organizationId: T.org, batchId: { not: null } },
        });
        expect(allEntries).toHaveLength(1 + stored!.groups.length + stored!.skills.length);
        const batchIds = new Set(allEntries.map((e) => e.batchId));
        expect(batchIds.size).toBe(1);
        const batch = await db.logBatch.findUnique({ where: { id: [...batchIds][0]! } });
        expect(batch).toMatchObject({ operationKey: "skill-package-import", userId: T.user });
    });

    it("refuses a package ID already owned by another organization", async () => {
        const envelope = makeEnvelope();
        await makeCaller().importPackage({
            organizationId: T.org,
            envelope,
            dryRun: false,
        });

        await expect(
            makeCaller().importPackage({
                organizationId: T.otherOrg,
                envelope,
                dryRun: true,
            }),
        ).rejects.toThrow(/different organisation/i);
    });

    it("requires the skillPackageBuilder create permission", async () => {
        await expect(
            makeCaller({}).importPackage({
                organizationId: T.org,
                envelope: makeEnvelope(),
                dryRun: true,
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
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
                permissions: { skillPackage: ["update"], organization: ["view"] },
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
                permissions: { skillPackage: ["update"], organization: ["view"] },
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

describe("skillPackageBuilderRouter.deleteSkill/Group/Package / recover*", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        pkg: SkillPackageId.create(),
        group: SkillGroupId.create(),
        skill: SkillId.create(),
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
                name: "Package",
                description: "",
                properties: {},
                tags: [],
            },
        });
        await db.skillGroup.create({
            data: {
                id: T.group,
                skillPackageId: T.pkg,
                name: "Group",
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
                name: "Skill",
                description: "",
                properties: {},
                tags: [],
                sequence: 1,
            },
        });
    });

    function makeCaller(perms: Permissions) {
        return skillPackageBuilderRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"], ...perms },
                prisma: db,
            }),
        );
    }

    it("deleteSkill/deleteGroup/deletePackage require skillPackage:delete", async () => {
        await expect(
            makeCaller({ skillPackage: ["update"] }).deleteSkill({
                organizationId: T.org,
                skillId: T.skill,
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
            makeCaller({ skillPackage: ["update"] }).deleteGroup({
                organizationId: T.org,
                skillGroupId: T.group,
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
            makeCaller({ skillPackage: ["update"] }).deletePackage({
                organizationId: T.org,
                skillPackageId: T.pkg,
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("soft-deletes skill, group, and package without cascading between levels", async () => {
        await makeCaller({ skillPackage: ["delete"] }).deleteSkill({
            organizationId: T.org,
            skillId: T.skill,
        });
        await makeCaller({ skillPackage: ["delete"] }).deleteGroup({
            organizationId: T.org,
            skillGroupId: T.group,
        });
        await makeCaller({ skillPackage: ["delete"] }).deletePackage({
            organizationId: T.org,
            skillPackageId: T.pkg,
        });

        expect(await db.skill.findUnique({ where: { id: T.skill } })).toMatchObject({
            status: "Deleted",
        });
        expect(await db.skillGroup.findUnique({ where: { id: T.group } })).toMatchObject({
            status: "Deleted",
        });
        expect(await db.skillPackage.findUnique({ where: { id: T.pkg } })).toMatchObject({
            status: "Deleted",
        });
    });

    it("recoverSkill/recoverGroup/recoverPackage require skillPackage:delete, not update", async () => {
        await expect(
            makeCaller({ skillPackage: ["update"] }).recoverSkill({
                organizationId: T.org,
                skillId: T.skill,
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
            makeCaller({ skillPackage: ["update"] }).recoverGroup({
                organizationId: T.org,
                skillGroupId: T.group,
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
        await expect(
            makeCaller({ skillPackage: ["update"] }).recoverPackage({
                organizationId: T.org,
                skillPackageId: T.pkg,
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("recovers the deleted skill, group, and package back to Active", async () => {
        const skill = await makeCaller({ skillPackage: ["delete"] }).recoverSkill({
            organizationId: T.org,
            skillId: T.skill,
        });
        expect(skill.updated.status).toBe("Active");

        const group = await makeCaller({
            skillPackage: ["delete"],
        }).recoverGroup({ organizationId: T.org, skillGroupId: T.group });
        expect(group.updated.status).toBe("Active");

        const pkg = await makeCaller({
            skillPackage: ["delete"],
        }).recoverPackage({ organizationId: T.org, skillPackageId: T.pkg });
        expect(pkg.updated.status).toBe("Active");
    });
});

describe("skillPackageBuilder.importPackageAsAdmin", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        admin: UserId.create(),
    };
    const db = createMockPrisma();

    function makeEnvelope(): SkillPackageExport {
        return {
            formatVersion: SKILL_PACKAGE_EXPORT_FORMAT_VERSION,
            exportedAt: new Date().toISOString(),
            package: {
                id: SkillPackageId.create(),
                name: "Starter Package",
                description: "A starter package for tests.",
                tags: [],
                properties: {},
                groups: [
                    {
                        id: SkillGroupId.create(),
                        name: "Group 1",
                        description: "",
                        tags: [],
                        properties: {},
                        sequence: 0,
                        defaultInclude: true,
                        skills: [
                            {
                                id: SkillId.create(),
                                name: "Skill 1",
                                description: "",
                                tags: [],
                                properties: {},
                                sequence: 0,
                                frequency: 12,
                                defaultInclude: true,
                                defaultRequired: true,
                            },
                        ],
                    },
                ],
            },
        };
    }

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: `acme-${nanoId16()}`, createdAt: new Date() },
        });
        await db.organization.create({
            data: {
                id: T.otherOrg,
                name: "Other",
                slug: `other-${nanoId16()}`,
                createdAt: new Date(),
            },
        });
        await db.user.create({
            data: { id: T.admin, name: "Dana Okafor", email: "dana@example.com", role: "admin" },
        });
    });

    function makeCaller() {
        return skillPackageBuilderRouter.createCaller(
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

    it("dryRun computes a plan without writing", async () => {
        const result = await makeCaller().importPackageAsAdmin({
            envelope: makeEnvelope(),
            targetOrganizationId: T.org,
            dryRun: true,
        });
        expect(result.applied).toBe(false);
        expect(result.plan.packageAction).toBe("Create");
        expect(await db.skillPackage.findMany({ where: { organizationId: T.org } })).toHaveLength(
            0,
        );
    });

    it("imports the tree unpublished and writes one SkillPackage log entry", async () => {
        const result = await makeCaller().importPackageAsAdmin({
            envelope: makeEnvelope(),
            targetOrganizationId: T.org,
            dryRun: false,
        });
        expect(result.applied).toBe(true);

        const stored = await db.skillPackage.findUnique({
            where: { id: result.plan.package.id },
            include: { groups: true, skills: true },
        });
        expect(stored?.organizationId).toBe(T.org);
        expect(stored?.published).toBe(false);
        expect(stored?.groups.length).toBeGreaterThan(0);
        expect(stored?.skills.length).toBeGreaterThan(0);

        const entries = await db.logEntry.findMany({
            where: { objectType: "SkillPackage", objectId: result.plan.package.id },
        });
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({
            scope: "organization",
            organizationId: T.org,
            action: "Create",
        });
    });

    it("refuses a package ID already owned by another organization", async () => {
        const envelope = makeEnvelope();
        await makeCaller().importPackageAsAdmin({
            envelope,
            targetOrganizationId: T.org,
            dryRun: false,
        });

        await expect(
            makeCaller().importPackageAsAdmin({
                envelope,
                targetOrganizationId: T.otherOrg,
                dryRun: true,
            }),
        ).rejects.toThrow(/different organisation/i);
    });
});

describe("skillPackageBuilderRouter log refs and moveSkill (#342)", () => {
    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        pkg: SkillPackageId.create(),
        otherPkg: SkillPackageId.create(),
        groupA: SkillGroupId.create(),
        groupB: SkillGroupId.create(),
        groupC: SkillGroupId.create(),
        newGroup: SkillGroupId.create(),
        skillEdit: SkillId.create(),
        skillReorder: SkillId.create(),
        skillMoveSame: SkillId.create(),
        skillMoveCross: SkillId.create(),
        skillStay: SkillId.create(),
        newSkill: SkillId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        for (const id of [T.pkg, T.otherPkg]) {
            await db.skillPackage.create({
                data: {
                    id,
                    organizationId: T.org,
                    name: `Package ${id}`,
                    description: "",
                    properties: {},
                    tags: [],
                },
            });
        }
        for (const [id, skillPackageId, sequence] of [
            [T.groupA, T.pkg, 1],
            [T.groupB, T.pkg, 2],
            [T.groupC, T.otherPkg, 1],
        ] as const) {
            await db.skillGroup.create({
                data: {
                    id,
                    skillPackageId,
                    name: `Group ${sequence}`,
                    description: "",
                    properties: {},
                    tags: [],
                    sequence,
                },
            });
        }
        const skills = [
            T.skillEdit,
            T.skillReorder,
            T.skillMoveSame,
            T.skillMoveCross,
            T.skillStay,
        ];
        for (const [index, id] of skills.entries()) {
            await db.skill.create({
                data: {
                    id,
                    skillPackageId: T.pkg,
                    skillGroupId: T.groupA,
                    name: `Skill ${index + 1}`,
                    description: "",
                    properties: {},
                    tags: [],
                    sequence: index + 1,
                },
            });
        }
    });

    function makeCaller() {
        return skillPackageBuilderRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { skillPackage: ["update"], organization: ["view"] },
                prisma: db,
            }),
        );
    }

    /** The one entry matching `where`, with its non-primary refs as `role:objectType:objectId`. */
    async function entryOf(where: { objectType: string; objectId: string; action: string }) {
        const entries = await db.logEntry.findMany({ where, include: { objects: true } });
        expect(entries).toHaveLength(1);
        return {
            entry: entries[0]!,
            refs: entries[0]!.objects
                .filter((ref) => ref.role !== "primary")
                .map((ref) => `${ref.role}:${ref.objectType}:${ref.objectId}`)
                .sort(),
        };
    }

    const groupFields = {
        name: "New group",
        description: "",
        tags: [],
        properties: {},
        defaultInclude: true,
    };
    const skillFields = {
        name: "New skill",
        description: "",
        tags: [],
        properties: {},
        frequency: 12,
        defaultInclude: true,
        defaultRequired: false,
    };

    it("createGroup refs the package as context", async () => {
        await makeCaller().createGroup({
            organizationId: T.org,
            skillPackageId: T.pkg,
            skillGroupId: T.newGroup,
            create: groupFields,
        });

        const { refs } = await entryOf({
            objectType: "SkillGroup",
            objectId: T.newGroup,
            action: "Create",
        });
        expect(refs).toEqual([`context:SkillPackage:${T.pkg}`]);
    });

    it("updateGroup refs the package as context", async () => {
        await makeCaller().updateGroup({
            organizationId: T.org,
            skillGroupId: T.groupB,
            update: { ...groupFields, name: "Renamed group" },
        });

        const { refs } = await entryOf({
            objectType: "SkillGroup",
            objectId: T.groupB,
            action: "Update",
        });
        expect(refs).toEqual([`context:SkillPackage:${T.pkg}`]);
    });

    it("reorderGroupSkills refs the package as context", async () => {
        await makeCaller().reorderGroupSkills({
            organizationId: T.org,
            skillGroupId: T.groupA,
            newOrder: [T.skillReorder, T.skillEdit],
        });

        const { refs } = await entryOf({
            objectType: "SkillGroup",
            objectId: T.groupA,
            action: "Update",
        });
        expect(refs).toEqual([`context:SkillPackage:${T.pkg}`]);
    });

    it("createSkill refs the package and the group as context", async () => {
        await makeCaller().createSkill({
            organizationId: T.org,
            skillId: T.newSkill,
            skillPackageId: T.pkg,
            skillGroupId: T.groupB,
            create: skillFields,
        });

        const { refs } = await entryOf({
            objectType: "Skill",
            objectId: T.newSkill,
            action: "Create",
        });
        expect(refs).toEqual([`context:SkillGroup:${T.groupB}`, `context:SkillPackage:${T.pkg}`]);
    });

    it("updateSkill refs the package and the group as context", async () => {
        await makeCaller().updateSkill({
            organizationId: T.org,
            skillId: T.skillEdit,
            update: { ...skillFields, name: "Edited skill" },
        });

        const { refs } = await entryOf({
            objectType: "Skill",
            objectId: T.skillEdit,
            action: "Update",
        });
        expect(refs).toEqual([`context:SkillGroup:${T.groupA}`, `context:SkillPackage:${T.pkg}`]);
    });

    it("moveSkill within a package logs Move with group from/to and package context", async () => {
        await makeCaller().moveSkill({
            organizationId: T.org,
            skillId: T.skillMoveSame,
            destinationPackageId: T.pkg,
            destinationGroupId: T.groupB,
        });

        const { entry, refs } = await entryOf({
            objectType: "Skill",
            objectId: T.skillMoveSame,
            action: "Move",
        });
        expect(refs).toEqual([
            `context:SkillPackage:${T.pkg}`,
            `from:SkillGroup:${T.groupA}`,
            `to:SkillGroup:${T.groupB}`,
        ]);
        expect(entry.changes).toEqual([
            { type: "obj_mod", path: ["skillGroupId"], prev: T.groupA, curr: T.groupB },
        ]);
    });

    it("moveSkill across packages refs the packages as from/to too", async () => {
        await makeCaller().moveSkill({
            organizationId: T.org,
            skillId: T.skillMoveCross,
            destinationPackageId: T.otherPkg,
            destinationGroupId: T.groupC,
        });

        const { refs } = await entryOf({
            objectType: "Skill",
            objectId: T.skillMoveCross,
            action: "Move",
        });
        expect(refs).toEqual([
            `from:SkillGroup:${T.groupA}`,
            `from:SkillPackage:${T.pkg}`,
            `to:SkillGroup:${T.groupC}`,
            `to:SkillPackage:${T.otherPkg}`,
        ]);
    });

    it("moveSkill to the skill's current group writes nothing", async () => {
        const before = await db.logEntry.count();

        const { updated } = await makeCaller().moveSkill({
            organizationId: T.org,
            skillId: T.skillStay,
            destinationPackageId: T.pkg,
            destinationGroupId: T.groupA,
        });

        expect(updated.skillGroupId).toBe(T.groupA);
        expect(await db.logEntry.count()).toBe(before);
    });
});
