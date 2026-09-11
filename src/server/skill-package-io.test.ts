/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { OrganizationId } from "@/lib/schemas/organization";
import { SkillId } from "@/lib/schemas/skill";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import {
    SKILL_PACKAGE_EXPORT_FORMAT_VERSION,
    type SkillPackageExport,
} from "@/lib/schemas/skill-package-export";
import { createMockPrisma } from "@/test/create-prisma-mock";

import { buildSkillPackageExport, prepareSkillPackageImport } from "./skill-package-io";

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

describe("prepareSkillPackageImport", () => {
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
        const { plan, buildWrites } = await prepareSkillPackageImport(
            db,
            env,
            targetOrganizationId,
        );
        await db.$transaction(buildWrites(db));
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
        const { plan } = await prepareSkillPackageImport(db, envelope(), T.orgA);

        expect(plan.package.action).toBe("unchanged");
        expect(plan.groups.every((g) => g.action === "unchanged")).toBe(true);
        expect(plan.skills.every((s) => s.action === "unchanged")).toBe(true);
    });

    it("rejects a package ID owned by a different organization", async () => {
        await apply(envelope(), T.orgA);
        await expect(prepareSkillPackageImport(db, envelope(), T.orgB)).rejects.toThrow(
            /different organization/i,
        );
    });

    it("rejects a file that repeats a skill ID", async () => {
        const dup = envelope();
        dup.package.groups[0]!.skills.push(dup.package.groups[0]!.skills[0]!);
        await expect(prepareSkillPackageImport(db, dup, T.orgA)).rejects.toThrow(/repeats/i);
    });
});

describe("buildSkillPackageExport", () => {
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
        const env = buildSkillPackageExport(pkg, pkg.groups, pkg.skills);

        expect(env.package.groups.map((g) => g.name)).toEqual(["Foundations", "Advanced"]);
        expect(env.package.groups[0]!.skills.map((s) => s.name)).toEqual(["Safety", "Comms"]);
    });
});
