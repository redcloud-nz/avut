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
