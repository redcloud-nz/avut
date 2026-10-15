/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ConflictError, ValidationError } from "@/lib/errors";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import {
    SKILL_PACKAGE_EXPORT_FORMAT_VERSION,
    type SkillPackageExport,
} from "@/lib/schemas/skill-package-export";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import * as SkillPackages from "./skill-packages";

const T = {
    orgA: OrganizationId.create(),
    orgB: OrganizationId.create(),
    pkg: SkillPackageId.create(),
    groupFoundations: SkillGroupId.create(),
    groupAdvanced: SkillGroupId.create(),
    skillSafety: SkillId.create(),
    skillComms: SkillId.create(),
    skillRescue: SkillId.create(),
};

function envelope(overrides?: Partial<SkillPackageExport["package"]>): SkillPackageExport {
    return {
        formatVersion: SKILL_PACKAGE_EXPORT_FORMAT_VERSION,
        exportedAt: "2026-09-10T00:00:00.000Z",
        package: {
            id: T.pkg,
            name: "Core Package",
            description: "",
            tags: [],
            properties: {},
            groups: [
                {
                    id: T.groupFoundations,
                    name: "Foundations",
                    description: "",
                    tags: [],
                    properties: {},
                    sequence: 1,
                    defaultInclude: true,
                    skills: [
                        {
                            id: T.skillSafety,
                            name: "Safety",
                            description: "",
                            tags: [],
                            properties: {},
                            sequence: 1,
                            frequency: 12,
                            defaultInclude: true,
                            defaultRequired: true,
                        },
                        {
                            id: T.skillComms,
                            name: "Comms",
                            description: "",
                            tags: [],
                            properties: {},
                            sequence: 2,
                            frequency: 12,
                            defaultInclude: true,
                            defaultRequired: false,
                        },
                    ],
                },
            ],
            ...overrides,
        },
    };
}

describe("SkillPackages.prepareImport", () => {
    let db: ReturnType<typeof createMockPrisma>;

    beforeEach(async () => {
        db = createMockPrisma();
        await db.organization.create({
            data: { id: T.orgA, name: "A", slug: "a", createdAt: new Date() },
        });
        await db.organization.create({
            data: { id: T.orgB, name: "B", slug: "b", createdAt: new Date() },
        });
    });

    async function apply(env: SkillPackageExport, targetOrganizationId: string) {
        const { plan, writeItems } = await SkillPackages.prepareImport(
            db,
            env,
            targetOrganizationId,
        );
        for (const item of writeItems) {
            await item.write(db);
        }
        return plan;
    }

    it("creates the whole tree for a new package", async () => {
        const plan = await apply(envelope(), T.orgA);

        expect(plan.packageAction).toBe("Create");
        expect(plan.package.action).toBe("create");
        expect(plan.groups.map((g) => g.action)).toEqual(["create"]);
        expect(plan.skills.map((s) => s.action)).toEqual(["create", "create"]);

        const stored = await db.skillPackage.findUnique({
            where: { id: T.pkg },
            include: { groups: true, skills: true },
        });
        expect(stored?.organizationId).toBe(T.orgA);
        expect(stored?.published).toBe(false);
        expect(stored?.groups).toHaveLength(1);
        expect(stored?.skills).toHaveLength(2);
    });

    it("always imports as unpublished, even re-importing a published package", async () => {
        await apply(envelope(), T.orgA);
        await db.skillPackage.update({ where: { id: T.pkg }, data: { published: true } });

        const plan = await apply(envelope(), T.orgA);

        expect(plan.packageAction).toBe("Update");
        const stored = await db.skillPackage.findUnique({ where: { id: T.pkg } });
        expect(stored?.published).toBe(false);
    });

    it("upserts changed rows and archives rows the file omits", async () => {
        await apply(envelope(), T.orgA);

        // Drop the Comms skill, rename Safety, add an Advanced group with a new skill.
        const next = envelope({
            groups: [
                {
                    id: T.groupFoundations,
                    name: "Foundations",
                    description: "",
                    tags: [],
                    properties: {},
                    sequence: 1,
                    defaultInclude: true,
                    skills: [
                        {
                            id: T.skillSafety,
                            name: "Safety (renamed)",
                            description: "",
                            tags: [],
                            properties: {},
                            sequence: 1,
                            frequency: 12,
                            defaultInclude: true,
                            defaultRequired: true,
                        },
                    ],
                },
                {
                    id: T.groupAdvanced,
                    name: "Advanced",
                    description: "",
                    tags: [],
                    properties: {},
                    sequence: 2,
                    defaultInclude: false,
                    skills: [
                        {
                            id: T.skillRescue,
                            name: "Rescue",
                            description: "",
                            tags: [],
                            properties: {},
                            sequence: 1,
                            frequency: 24,
                            defaultInclude: true,
                            defaultRequired: false,
                        },
                    ],
                },
            ],
        });

        const plan = await apply(next, T.orgA);

        const safety = plan.skills.find((s) => s.id === T.skillSafety);
        const comms = plan.skills.find((s) => s.id === T.skillComms);
        const rescue = plan.skills.find((s) => s.id === T.skillRescue);
        expect(safety?.action).toBe("update");
        expect(comms?.action).toBe("archive");
        expect(rescue?.action).toBe("create");

        const stored = await db.skill.findUnique({ where: { id: T.skillComms } });
        expect(stored?.status).toBe("Archived");
        const rescueStored = await db.skill.findUnique({ where: { id: T.skillRescue } });
        expect(rescueStored?.status).toBe("Active");
    });

    it("reports unchanged rows on an identical re-import", async () => {
        await apply(envelope(), T.orgA);
        const { plan } = await SkillPackages.prepareImport(db, envelope(), T.orgA);

        expect(plan.package.action).toBe("unchanged");
        expect(plan.groups.every((g) => g.action === "unchanged")).toBe(true);
        expect(plan.skills.every((s) => s.action === "unchanged")).toBe(true);
    });

    it("rejects a package ID owned by a different organization", async () => {
        await apply(envelope(), T.orgA);
        await expect(SkillPackages.prepareImport(db, envelope(), T.orgB)).rejects.toThrow(
            ConflictError,
        );
    });

    it("rejects a file that repeats a skill ID", async () => {
        const dup = envelope();
        dup.package.groups[0]!.skills.push(dup.package.groups[0]!.skills[0]!);
        await expect(SkillPackages.prepareImport(db, dup, T.orgA)).rejects.toThrow(ValidationError);
    });
});

describe("SkillPackages.buildExport", () => {
    it("nests and sequence-sorts groups and skills", async () => {
        const db = createMockPrisma();
        await db.organization.create({
            data: { id: T.orgA, name: "A", slug: "a", createdAt: new Date() },
        });
        await db.skillPackage.create({
            data: {
                id: T.pkg,
                organizationId: T.orgA,
                name: "P",
                description: "",
                properties: {},
                tags: [],
            },
        });
        await db.skillGroup.create({
            data: {
                id: T.groupAdvanced,
                skillPackageId: T.pkg,
                name: "Advanced",
                description: "",
                properties: {},
                tags: [],
                sequence: 2,
            },
        });
        await db.skillGroup.create({
            data: {
                id: T.groupFoundations,
                skillPackageId: T.pkg,
                name: "Foundations",
                description: "",
                properties: {},
                tags: [],
                sequence: 1,
            },
        });
        await db.skill.create({
            data: {
                id: T.skillComms,
                skillPackageId: T.pkg,
                skillGroupId: T.groupFoundations,
                name: "Comms",
                description: "",
                properties: {},
                tags: [],
                sequence: 2,
            },
        });
        await db.skill.create({
            data: {
                id: T.skillSafety,
                skillPackageId: T.pkg,
                skillGroupId: T.groupFoundations,
                name: "Safety",
                description: "",
                properties: {},
                tags: [],
                sequence: 1,
            },
        });

        const pkg = await db.skillPackage.findUniqueOrThrow({
            where: { id: T.pkg },
            include: { groups: true, skills: true },
        });
        const env = SkillPackages.buildExport(pkg, pkg.groups, pkg.skills);

        expect(env.package.groups.map((g) => g.name)).toEqual(["Foundations", "Advanced"]);
        expect(env.package.groups[0]!.skills.map((s) => s.name)).toEqual(["Safety", "Comms"]);
    });
});

describe("SkillPackages.requireSkillById / requireGroupById / requirePackageById", () => {
    const U = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        pkg: SkillPackageId.create(),
        group: SkillGroupId.create(),
        skill: SkillId.create(),
        user: UserId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [U.org, U.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }
        await db.skillPackage.create({
            data: {
                id: U.pkg,
                organizationId: U.org,
                name: "P",
                description: "",
                properties: {},
                tags: [],
            },
        });
        await db.skillGroup.create({
            data: {
                id: U.group,
                skillPackageId: U.pkg,
                name: "Group",
                description: "",
                properties: {},
                tags: [],
                sequence: 1,
            },
        });
        await db.skill.create({
            data: {
                id: U.skill,
                skillPackageId: U.pkg,
                skillGroupId: U.group,
                name: "Skill",
                description: "",
                properties: {},
                tags: [],
                sequence: 1,
            },
        });
    });

    function ctx() {
        return createOrganizationMockContext({
            organizationId: U.org,
            user: { id: U.user },
            permissions: {},
            prisma: db,
        });
    }

    it("requireSkill returns the skill when it belongs to the organization", async () => {
        const skill = await SkillPackages.requireSkillById(ctx(), U.skill);
        expect(skill.id).toBe(U.skill);
    });

    it("requireSkill throws NotFoundError for an unknown skill", async () => {
        await expect(SkillPackages.requireSkillById(ctx(), SkillId.create())).rejects.toThrow(
            "not found",
        );
    });

    it("requireSkill throws NotFoundError for a skill in another organization", async () => {
        await expect(
            SkillPackages.requireSkillById(
                createOrganizationMockContext({
                    organizationId: U.otherOrg,
                    user: { id: U.user },
                    permissions: {},
                    prisma: db,
                }),
                U.skill,
            ),
        ).rejects.toThrow(`Skill(id=${U.skill}) not found.`);
    });

    it("requireGroup returns the group when it belongs to the organization", async () => {
        const group = await SkillPackages.requireGroupById(ctx(), U.group);
        expect(group.id).toBe(U.group);
    });

    it("requireGroup throws NotFoundError for an unknown group", async () => {
        await expect(SkillPackages.requireGroupById(ctx(), SkillGroupId.create())).rejects.toThrow(
            "not found",
        );
    });

    it("requireGroup throws NotFoundError for a group in another organization", async () => {
        await expect(
            SkillPackages.requireGroupById(
                createOrganizationMockContext({
                    organizationId: U.otherOrg,
                    user: { id: U.user },
                    permissions: {},
                    prisma: db,
                }),
                U.group,
            ),
        ).rejects.toThrow(`SkillGroup(id=${U.group}) not found.`);
    });

    it("requirePackage returns the package when it belongs to the organization", async () => {
        const pkg = await SkillPackages.requirePackageById(ctx(), U.pkg);
        expect(pkg.id).toBe(U.pkg);
    });

    it("requirePackage throws NotFoundError for a package in another organization", async () => {
        await expect(
            SkillPackages.requirePackageById(
                createOrganizationMockContext({
                    organizationId: U.otherOrg,
                    user: { id: U.user },
                    permissions: {},
                    prisma: db,
                }),
                U.pkg,
            ),
        ).rejects.toThrow(`SkillPackage(id=${U.pkg}) not found.`);
    });
});

describe("SkillPackages archive / restore / recover / delete", () => {
    const L = {
        org: OrganizationId.create(),
        user: UserId.create(),
        pkg: SkillPackageId.create(),
        group: SkillGroupId.create(),
        skill: SkillId.create(),
        assessee: PersonId.create(),
        assessor: PersonId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: L.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });
        await db.skillPackage.create({
            data: {
                id: L.pkg,
                organizationId: L.org,
                name: "Lifecycle Package",
                description: "",
                properties: {},
                tags: [],
            },
        });
        await db.skillGroup.create({
            data: {
                id: L.group,
                skillPackageId: L.pkg,
                name: "Lifecycle Group",
                description: "",
                properties: {},
                tags: [],
                sequence: 1,
            },
        });
        await db.skill.create({
            data: {
                id: L.skill,
                skillPackageId: L.pkg,
                skillGroupId: L.group,
                name: "Lifecycle Skill",
                description: "",
                properties: {},
                tags: [],
                sequence: 1,
            },
        });
        await db.person.create({
            data: {
                id: L.assessee,
                organizationId: L.org,
                name: "Assessee",
                email: "assessee-skill-packages-lifecycle@example.com",
                tags: [],
                properties: {},
            },
        });
        await db.person.create({
            data: {
                id: L.assessor,
                organizationId: L.org,
                name: "Assessor",
                email: "assessor-skill-packages-lifecycle@example.com",
                tags: [],
                properties: {},
            },
        });
        await db.skillCheck.create({
            data: {
                id: "check-1",
                organizationId: L.org,
                assesseeId: L.assessee,
                assessorId: L.assessor,
                skillId: L.skill,
                result: "Pass",
                notes: "",
                checkedAt: new Date(),
            },
        });
    });

    function ctx() {
        return createOrganizationMockContext({
            organizationId: L.org,
            user: { id: L.user },
            permissions: {},
            prisma: db,
        });
    }

    it("archiveSkill/archiveGroup/archivePackage move Active rows to Archived and are idempotent", async () => {
        const skill = await SkillPackages.archiveSkill(ctx(), L.skill);
        expect(skill.status).toBe("Archived");
        await SkillPackages.archiveSkill(ctx(), L.skill);
        expect(
            await db.logEntry.findMany({
                where: { objectType: "Skill", objectId: L.skill, action: "Archive" },
            }),
        ).toHaveLength(1);

        const group = await SkillPackages.archiveGroup(ctx(), L.group);
        expect(group.status).toBe("Archived");

        const pkg = await SkillPackages.archivePackage(ctx(), L.pkg);
        expect(pkg.status).toBe("Archived");
    });

    it("recoverSkill rejects an Archived skill", async () => {
        await expect(SkillPackages.recoverSkill(ctx(), L.skill)).rejects.toThrow(
            /only a Deleted skill can be recovered from rubbish/,
        );
    });

    it("restoreSkill moves an Archived skill back to Active and records a Restore log entry", async () => {
        const restored = await SkillPackages.restoreSkill(ctx(), L.skill);
        expect(restored.status).toBe("Active");

        const entries = await db.logEntry.findMany({
            where: { objectType: "Skill", objectId: L.skill, action: "Restore" },
        });
        expect(entries).toHaveLength(1);
    });

    it("restoreGroup moves an Archived group back to Active and records a Restore log entry", async () => {
        const restored = await SkillPackages.restoreGroup(ctx(), L.group);
        expect(restored.status).toBe("Active");

        const entries = await db.logEntry.findMany({
            where: { objectType: "SkillGroup", objectId: L.group, action: "Restore" },
        });
        expect(entries).toHaveLength(1);
    });

    it("restorePackage moves an Archived package back to Active and records a Restore log entry", async () => {
        const restored = await SkillPackages.restorePackage(ctx(), L.pkg);
        expect(restored.status).toBe("Active");

        const entries = await db.logEntry.findMany({
            where: { objectType: "SkillPackage", objectId: L.pkg, action: "Restore" },
        });
        expect(entries).toHaveLength(1);
    });

    it("deleteSkill/deleteGroup/deletePackage soft-delete without cascading between levels", async () => {
        const skill = await SkillPackages.deleteSkill(ctx(), L.skill);
        expect(skill.status).toBe("Deleted");

        const group = await SkillPackages.deleteGroup(ctx(), L.group);
        expect(group.status).toBe("Deleted");

        const pkg = await SkillPackages.deletePackage(ctx(), L.pkg);
        expect(pkg.status).toBe("Deleted");

        // No cascade — each level's status is independent.
        expect((await SkillPackages.requireSkillById(ctx(), L.skill)).status).toBe("Deleted");
        expect((await SkillPackages.requireGroupById(ctx(), L.group)).status).toBe("Deleted");
    });

    it("archiveSkill/archiveGroup/archivePackage reject a Deleted row", async () => {
        await expect(SkillPackages.archiveSkill(ctx(), L.skill)).rejects.toThrow(
            /only an Active skill can be archived/,
        );
        await expect(SkillPackages.archiveGroup(ctx(), L.group)).rejects.toThrow(
            /only an Active group can be archived/,
        );
        await expect(SkillPackages.archivePackage(ctx(), L.pkg)).rejects.toThrow(
            /only an Active package can be archived/,
        );

        // Rejected archive attempts must not have mutated status out of Deleted.
        expect((await SkillPackages.requireSkillById(ctx(), L.skill)).status).toBe("Deleted");
        expect((await SkillPackages.requireGroupById(ctx(), L.group)).status).toBe("Deleted");
        expect((await SkillPackages.requirePackageById(ctx(), L.pkg)).status).toBe("Deleted");
    });

    it("restoreSkill rejects a Deleted skill", async () => {
        await expect(SkillPackages.restoreSkill(ctx(), L.skill)).rejects.toThrow(
            /only an Archived skill can be restored from archive/,
        );
    });

    it("recoverSkill/recoverGroup/recoverPackage move Deleted rows back to Active and record Recover log entries", async () => {
        expect((await SkillPackages.recoverSkill(ctx(), L.skill)).status).toBe("Active");
        expect((await SkillPackages.recoverGroup(ctx(), L.group)).status).toBe("Active");
        expect((await SkillPackages.recoverPackage(ctx(), L.pkg)).status).toBe("Active");

        expect(
            await db.logEntry.findMany({
                where: { objectType: "Skill", objectId: L.skill, action: "Recover" },
            }),
        ).toHaveLength(1);
        expect(
            await db.logEntry.findMany({
                where: { objectType: "SkillGroup", objectId: L.group, action: "Recover" },
            }),
        ).toHaveLength(1);
        expect(
            await db.logEntry.findMany({
                where: { objectType: "SkillPackage", objectId: L.pkg, action: "Recover" },
            }),
        ).toHaveLength(1);
    });

    it("getSkillDeleteImpact counts recorded skill checks", async () => {
        expect(await SkillPackages.getSkillDeleteImpact(ctx(), L.skill)).toEqual({
            skillCheckCount: 1,
        });
    });

    it("getGroupDeleteImpact counts active skills in the group", async () => {
        expect(await SkillPackages.getGroupDeleteImpact(ctx(), L.group)).toEqual({
            skillCount: 1,
        });
    });

    it("getPackageDeleteImpact counts active groups and skills in the package", async () => {
        expect(await SkillPackages.getPackageDeleteImpact(ctx(), L.pkg)).toEqual({
            groupCount: 1,
            skillCount: 1,
        });
    });

    it("deletePackage unpublishes a published package and recoverPackage leaves it unpublished", async () => {
        await db.skillPackage.update({ where: { id: L.pkg }, data: { published: true } });

        const deleted = await SkillPackages.deletePackage(ctx(), L.pkg);
        expect(deleted).toMatchObject({ status: "Deleted", published: false });
        expect(
            await db.logEntry.findMany({
                where: { objectType: "SkillPackage", objectId: L.pkg, action: "Unpublish" },
            }),
        ).toHaveLength(1);

        const recovered = await SkillPackages.recoverPackage(ctx(), L.pkg);
        expect(recovered).toMatchObject({ status: "Active", published: false });
    });
});
