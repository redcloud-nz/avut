/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheckId } from "@/lib/schemas/skill-check";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import * as Trash from "./trash";

describe("Trash service", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: UserId.create(),
        // Person in the bin who assessed an active person's skill check.
        assessor: PersonId.create(),
        assessee: PersonId.create(),
        activeTeam: TeamId.create(),
        // Package whose skill another org has recorded a check against.
        sharedPkg: SkillPackageId.create(),
        sharedGroup: SkillGroupId.create(),
        sharedSkill: SkillId.create(),
        otherOrgPerson: PersonId.create(),
        // For purgeExpired: expired, not yet expired, and undated.
        expiredTeam: TeamId.create(),
        freshTeam: TeamId.create(),
        undatedTeam: TeamId.create(),
        check: SkillCheckId.create(),
    };

    const db = createMockPrisma();
    const now = new Date("2026-06-01T00:00:00.000Z");
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

    function ctx() {
        return createOrganizationMockContext({
            organizationId: T.org,
            user: { id: T.user },
            prisma: db,
        });
    }

    async function logDelete(objectType: string, objectId: string, timestamp: Date) {
        await db.logEntry.create({
            data: {
                id: nanoId16(),
                scope: "organization",
                organizationId: T.org,
                action: "Delete",
                objectType,
                objectId,
                timestamp,
            },
        });
    }

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }
        for (const [id, org, name, status] of [
            [T.assessor, T.org, "Ada Assessor", "Deleted"],
            [T.assessee, T.org, "Bo Assessee", "Active"],
            [T.otherOrgPerson, T.otherOrg, "Cy Elsewhere", "Active"],
        ] as const) {
            await db.person.create({
                data: {
                    id,
                    organizationId: org,
                    name,
                    email: `${id}@example.com`,
                    tags: [],
                    properties: {},
                    status,
                },
            });
        }
        for (const [id, status] of [
            [T.activeTeam, "Active"],
            [T.expiredTeam, "Deleted"],
            [T.freshTeam, "Deleted"],
            [T.undatedTeam, "Deleted"],
        ] as const) {
            await db.team.create({
                data: { id, organizationId: T.org, name: id, tags: [], properties: {}, status },
            });
        }
        await db.skillPackage.create({
            data: {
                id: T.sharedPkg,
                organizationId: T.org,
                name: "Shared",
                description: "",
                tags: [],
                properties: {},
                status: "Deleted",
            },
        });
        await db.skillGroup.create({
            data: {
                id: T.sharedGroup,
                skillPackageId: T.sharedPkg,
                name: "Group",
                description: "",
                tags: [],
                properties: {},
                sequence: 0,
            },
        });
        await db.skill.create({
            data: {
                id: T.sharedSkill,
                skillPackageId: T.sharedPkg,
                skillGroupId: T.sharedGroup,
                name: "Knots",
                description: "",
                tags: [],
                properties: {},
                sequence: 0,
            },
        });
        await db.skillCheck.create({
            data: {
                id: T.check,
                organizationId: T.org,
                assesseeId: T.assessee,
                assessorId: T.assessor,
                skillId: T.sharedSkill,
                result: "Pass",
                notes: "",
            },
        });
        // Recorded by another org that subscribed to the package.
        await db.skillCheck.create({
            data: {
                id: SkillCheckId.create(),
                organizationId: T.otherOrg,
                assesseeId: T.otherOrgPerson,
                assessorId: T.otherOrgPerson,
                skillId: T.sharedSkill,
                result: "Pass",
                notes: "",
            },
        });
        // A tombstone from that org too, which the blocker's count leaves out.
        await db.skillCheck.create({
            data: {
                id: SkillCheckId.create(),
                organizationId: T.otherOrg,
                assesseeId: T.otherOrgPerson,
                assessorId: null,
                skillId: T.sharedSkill,
                result: "Pass",
                notes: "",
                status: "Deleted",
            },
        });

        await logDelete("Team", T.expiredTeam, daysAgo(31));
        await logDelete("Team", T.freshTeam, daysAgo(5));
        await logDelete("SkillPackage", T.sharedPkg, daysAgo(60));
    });

    it("refuses to purge a record that isn't in the Rubbish bin", async () => {
        await expect(Trash.purge(ctx(), "team", T.activeTeam)).rejects.toThrow(
            /only a Deleted record is in the Rubbish bin/,
        );
        expect(await db.team.findUnique({ where: { id: T.activeTeam } })).not.toBeNull();
    });

    it("refuses to purge a skill package another organisation has recorded checks against, counting only live checks", async () => {
        await expect(Trash.purge(ctx(), "skillPackage", T.sharedPkg)).rejects.toThrow(
            /Other organisations have recorded 1 skill check/,
        );
        expect(await db.skillPackage.findUnique({ where: { id: T.sharedPkg } })).not.toBeNull();
    });

    it("purgeExpired purges past-window rows and reports blocked and undated ones", async () => {
        const summary = await Trash.purgeExpired(ctx(), now, ["team", "skillPackage"]);

        expect(summary.purged).toEqual([{ type: "team", id: T.expiredTeam }]);
        expect(summary.blocked).toEqual([
            expect.objectContaining({ type: "skillPackage", id: T.sharedPkg }),
        ]);
        expect(summary.undated).toEqual([{ type: "team", id: T.undatedTeam }]);
        expect(summary.failed).toEqual([]);

        expect(await db.team.findUnique({ where: { id: T.expiredTeam } })).toBeNull();
        expect(await db.team.findUnique({ where: { id: T.freshTeam } })).not.toBeNull();
        expect(
            await db.logEntry.findMany({
                where: { objectType: "Team", objectId: T.expiredTeam, action: "Purge" },
            }),
        ).toHaveLength(1);
    });

    it("purgeExpired is idempotent", async () => {
        const summary = await Trash.purgeExpired(ctx(), now, ["team"]);
        expect(summary.purged).toEqual([]);
    });

    it("purging a person keeps the checks they assessed, labelled with their name", async () => {
        await Trash.purge(ctx(), "person", T.assessor);

        expect(await db.person.findUnique({ where: { id: T.assessor } })).toBeNull();
        const check = await db.skillCheck.findUnique({ where: { id: T.check } });
        expect(check).toMatchObject({ assesseeId: T.assessee, assessorLabel: "Ada Assessor" });
        expect(
            await db.logEntry.findMany({
                where: { objectType: "Person", objectId: T.assessor, action: "Purge" },
            }),
        ).toHaveLength(1);
    });

    it("recover moves a Deleted row back to Active through the entity's service", async () => {
        await Trash.recover(ctx(), "team", T.freshTeam);
        expect((await db.team.findUnique({ where: { id: T.freshTeam } }))?.status).toBe("Active");
    });
});

describe("Trash.runAutoPurge", () => {
    const T = {
        dueOrg: OrganizationId.create(),
        quietOrg: OrganizationId.create(),
        expiredTeam: TeamId.create(),
        freshTeam: TeamId.create(),
    };

    const db = createMockPrisma();
    const now = new Date("2026-06-01T00:00:00.000Z");

    beforeAll(async () => {
        for (const id of [T.dueOrg, T.quietOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }
        for (const [id, organizationId, deletedAt] of [
            [T.expiredTeam, T.dueOrg, new Date("2026-04-01T00:00:00.000Z")],
            [T.freshTeam, T.quietOrg, new Date("2026-05-30T00:00:00.000Z")],
        ] as const) {
            await db.team.create({
                data: { id, organizationId, name: id, tags: [], properties: {}, status: "Deleted" },
            });
            await db.logEntry.create({
                data: {
                    id: nanoId16(),
                    scope: "organization",
                    organizationId,
                    action: "Delete",
                    objectType: "Team",
                    objectId: id,
                    timestamp: deletedAt,
                },
            });
        }
    });

    it("purges what's due under an actor-less rubbish-purge batch, and skips orgs with nothing due", async () => {
        const results = await Trash.runAutoPurge(db, now);

        expect(results).toEqual([
            {
                organizationId: T.dueOrg,
                summary: {
                    purged: [{ type: "team", id: T.expiredTeam }],
                    blocked: [],
                    undated: [],
                    failed: [],
                },
            },
        ]);
        expect(await db.team.findUnique({ where: { id: T.freshTeam } })).not.toBeNull();

        const batches = await db.logBatch.findMany();
        expect(batches).toEqual([expect.objectContaining({ operationKey: "rubbish-purge" })]);
        const [purge] = await db.logEntry.findMany({ where: { action: "Purge" } });
        expect(purge).toMatchObject({
            organizationId: T.dueOrg,
            objectId: T.expiredTeam,
            userId: null,
            batchId: batches[0].id,
        });
    });
});
