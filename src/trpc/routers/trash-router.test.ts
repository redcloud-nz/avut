/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { nanoId16 } from "@/lib/id";
import { I3TemplateId } from "@/lib/schemas/i3-template";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { trashRouter } from "./trash-router";

// The router reaches server-only modules at import time. The procedures exercised here use
// ctx.prisma (the injected mock), so an empty stub is enough to let them import in jsdom.
vi.mock("server-only", () => ({}));

describe("trash.listTrash", () => {
    const T = {
        org: OrganizationId.create(),
        adminUser: UserId.create(),
        personOnlyUser: UserId.create(),
        outsiderUser: UserId.create(),
        deletedPerson: PersonId.create(),
        activePerson: PersonId.create(),
        deletedTeam: TeamId.create(),
        membershipTeam: TeamId.create(),
        deletedMembershipId: nanoId16(),
        deletedTemplate: I3TemplateId.create(),
        pkg: SkillPackageId.create(),
        deletedGroup: SkillGroupId.create(),
        deletedSkill: SkillId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme", createdAt: new Date() },
        });

        await db.person.create({
            data: {
                id: T.deletedPerson,
                organizationId: T.org,
                name: "Grace Hopper",
                email: "grace-trash@example.com",
                tags: [],
                properties: {},
                status: "Deleted",
            },
        });
        await db.person.create({
            data: {
                id: T.activePerson,
                organizationId: T.org,
                name: "Ada Lovelace",
                email: "ada-trash@example.com",
                tags: [],
                properties: {},
                status: "Active",
            },
        });
        await db.team.create({
            data: {
                id: T.deletedTeam,
                organizationId: T.org,
                name: "Doomed Team",
                tags: [],
                properties: {},
                status: "Deleted",
            },
        });
        await db.team.create({
            data: {
                id: T.membershipTeam,
                organizationId: T.org,
                name: "Membership Team",
                tags: [],
                properties: {},
                status: "Active",
            },
        });
        await db.teamMembership.create({
            data: {
                id: T.deletedMembershipId,
                organizationId: T.org,
                teamId: T.membershipTeam,
                personId: T.activePerson,
                tags: [],
                properties: {},
                status: "Deleted",
            },
        });
        await db.i3Template.create({
            data: {
                id: T.deletedTemplate,
                organizationId: T.org,
                name: "Doomed Template",
                description: "",
                status: "Deleted",
            },
        });
        await db.skillPackage.create({
            data: {
                id: T.pkg,
                organizationId: T.org,
                name: "Active Package",
                description: "",
                tags: [],
                properties: {},
                status: "Active",
            },
        });
        await db.skillGroup.create({
            data: {
                id: T.deletedGroup,
                skillPackageId: T.pkg,
                name: "Doomed Group",
                description: "",
                tags: [],
                properties: {},
                sequence: 1,
                status: "Deleted",
            },
        });
        await db.skill.create({
            data: {
                id: T.deletedSkill,
                skillPackageId: T.pkg,
                skillGroupId: T.deletedGroup,
                name: "Doomed Skill",
                description: "",
                tags: [],
                properties: {},
                sequence: 1,
                status: "Deleted",
            },
        });

        await db.logEntry.create({
            data: {
                id: nanoId16(),
                scope: "organization",
                organizationId: T.org,
                action: "Delete",
                objectType: "Person",
                objectId: T.deletedPerson,
                timestamp: new Date("2026-01-01T00:00:00.000Z"),
            },
        });
        await db.logEntry.create({
            data: {
                id: nanoId16(),
                scope: "organization",
                organizationId: T.org,
                action: "Delete",
                objectType: "Team",
                objectId: T.deletedTeam,
                timestamp: new Date("2026-02-01T00:00:00.000Z"),
            },
        });
        await db.logEntry.create({
            data: {
                id: nanoId16(),
                scope: "organization",
                organizationId: T.org,
                action: "Delete",
                objectType: "TeamMembership",
                objectId: T.deletedMembershipId,
                timestamp: new Date("2026-03-01T00:00:00.000Z"),
            },
        });
        await db.logEntry.create({
            data: {
                id: nanoId16(),
                scope: "organization",
                organizationId: T.org,
                action: "Delete",
                objectType: "I3Template",
                objectId: T.deletedTemplate,
                timestamp: new Date("2026-03-02T00:00:00.000Z"),
            },
        });

        // A role on `organizationUser` for each caller, since `listTrash` reads roles directly
        // rather than through `ctx.hasPermission`.
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.adminUser,
                role: "admin",
            },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.personOnlyUser,
                role: "skills-assessor",
            },
        });
    });

    function makeCaller(
        userId: string,
        permissions: Record<string, string[]> = { organization: ["view"] },
    ) {
        return trashRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: userId },
                // `listTrash` filters per entity by reading `organizationUser.role` itself, not
                // via `ctx.hasPermission` — the mock's `organization:view` here only satisfies
                // `organizationProcedure`'s own base check.
                permissions,
                prisma: db,
            }),
        );
    }

    it("lists Deleted records across entity types for an admin, with deletedAt resolved", async () => {
        const rows = await makeCaller(T.adminUser).listTrash({ organizationId: T.org });

        expect(rows).toHaveLength(6);
        const person = rows.find((r) => r.id === T.deletedPerson);
        const team = rows.find((r) => r.id === T.deletedTeam);
        const membership = rows.find((r) => r.id === T.deletedMembershipId);
        const template = rows.find((r) => r.id === T.deletedTemplate);
        const group = rows.find((r) => r.id === T.deletedGroup);
        const skill = rows.find((r) => r.id === T.deletedSkill);

        expect(person).toMatchObject({ type: "person", name: "Grace Hopper" });
        expect(person?.deletedAt).toBe("2026-01-01T00:00:00.000Z");
        // Default 30-day retention.
        expect(person?.purgeAt).toBe("2026-01-31T00:00:00.000Z");
        expect(team).toMatchObject({ type: "team", name: "Doomed Team" });
        expect(team?.deletedAt).toBe("2026-02-01T00:00:00.000Z");
        expect(membership).toMatchObject({
            type: "teamMembership",
            name: "Ada Lovelace in Membership Team",
            teamId: T.membershipTeam,
            personId: T.activePerson,
        });
        expect(membership?.deletedAt).toBe("2026-03-01T00:00:00.000Z");
        expect(template).toMatchObject({ type: "i3Template", name: "Doomed Template" });
        expect(template?.deletedAt).toBe("2026-03-02T00:00:00.000Z");
        expect(group).toMatchObject({
            type: "skillGroup",
            name: "Doomed Group",
            skillPackageId: T.pkg,
        });
        expect(skill).toMatchObject({
            type: "skill",
            name: "Doomed Skill",
            skillPackageId: T.pkg,
            // No Delete log entry — never auto-purged.
            deletedAt: null,
            purgeAt: null,
        });
    });

    it("does not list Active records", async () => {
        const rows = await makeCaller(T.adminUser).listTrash({ organizationId: T.org });
        expect(rows.find((r) => r.id === T.activePerson)).toBeUndefined();
    });

    it("omits an entity's rows for a caller without delete permission on it", async () => {
        // `skills-assessor` has neither person:delete nor team:delete.
        const rows = await makeCaller(T.personOnlyUser).listTrash({ organizationId: T.org });
        expect(rows).toHaveLength(0);
    });

    it("is forbidden without organization:view permission", async () => {
        await expect(
            makeCaller(T.outsiderUser, {}).listTrash({ organizationId: T.org }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
});

describe("trash.recoverRecord / trash.purgeRecord", () => {
    const T = {
        org: OrganizationId.create(),
        adminUser: UserId.create(),
        assessorUser: UserId.create(),
        recoverTeam: TeamId.create(),
        purgeTeam: TeamId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Acme", slug: "acme-2", createdAt: new Date() },
        });
        for (const id of [T.recoverTeam, T.purgeTeam]) {
            await db.team.create({
                data: {
                    id,
                    organizationId: T.org,
                    name: id,
                    tags: [],
                    properties: {},
                    status: "Deleted",
                },
            });
        }
        for (const [userId, role] of [
            [T.adminUser, "admin"],
            [T.assessorUser, "skills-assessor"],
        ] as const) {
            await db.organizationUser.create({
                data: { id: nanoId16(), organizationId: T.org, userId, role },
            });
        }
    });

    function makeCaller(userId: string) {
        return trashRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: userId },
                permissions: { organization: ["view"] },
                prisma: db,
            }),
        );
    }

    it("refuses both without the entity's delete permission", async () => {
        const input = { organizationId: T.org, type: "team" as const, id: T.purgeTeam };
        await expect(makeCaller(T.assessorUser).purgeRecord(input)).rejects.toMatchObject({
            code: "FORBIDDEN",
        });
        await expect(makeCaller(T.assessorUser).recoverRecord(input)).rejects.toMatchObject({
            code: "FORBIDDEN",
        });
        expect(await db.team.findUnique({ where: { id: T.purgeTeam } })).not.toBeNull();
    });

    it("recoverRecord brings a Deleted team back to Active", async () => {
        await makeCaller(T.adminUser).recoverRecord({
            organizationId: T.org,
            type: "team",
            id: T.recoverTeam,
        });
        expect((await db.team.findUnique({ where: { id: T.recoverTeam } }))?.status).toBe("Active");
    });

    it("purgeRecord permanently deletes a Deleted team, and rejects an Active one", async () => {
        await makeCaller(T.adminUser).purgeRecord({
            organizationId: T.org,
            type: "team",
            id: T.purgeTeam,
        });
        expect(await db.team.findUnique({ where: { id: T.purgeTeam } })).toBeNull();

        await expect(
            makeCaller(T.adminUser).purgeRecord({
                organizationId: T.org,
                type: "team",
                id: T.recoverTeam,
            }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
});
