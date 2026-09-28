/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { TRPCError } from "@trpc/server";

import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { skillCheckSessionsRouter } from "./skill-check-sessions-router";

describe("skillCheckSessions.upsertSessionSkillChecks", () => {
    // Dataset:
    //   assessorUser  → org member, linked to assessorPerson, assigned as the session's assessor
    //   otherUser     → org member, linked to otherPerson, NOT assigned to the session
    //   session       → has one skill (skill1) and assessorPerson as its sole assessor
    //   unscopedSession → has no assessors at all (nobody may record on it)
    const T = {
        org: OrganizationId.create(),
        assessorUser: UserId.create(),
        otherUser: UserId.create(),
        assessorPerson: PersonId.create(),
        otherPerson: PersonId.create(),
        assessee: PersonId.create(),
        pkg: SkillPackageId.create(),
        grp: SkillGroupId.create(),
        skill1: SkillId.create(),
        skill2: SkillId.create(),
        skill3: SkillId.create(),
        session: SkillCheckSessionId.create(),
        unscopedSession: SkillCheckSessionId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Test Org", slug: T.org, createdAt: new Date() },
        });

        await db.person.create({
            data: {
                id: T.assessorPerson,
                organizationId: T.org,
                name: "Assessor Assigned",
                email: `${T.assessorPerson}@example.com`,
            },
        });
        await db.person.create({
            data: {
                id: T.otherPerson,
                organizationId: T.org,
                name: "Assessor Other",
                email: `${T.otherPerson}@example.com`,
            },
        });
        await db.person.create({
            data: {
                id: T.assessee,
                organizationId: T.org,
                name: "Assessee",
                email: `${T.assessee}@example.com`,
            },
        });

        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.assessorUser,
                role: "member",
                personId: T.assessorPerson,
            },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.otherUser,
                role: "member",
                personId: T.otherPerson,
            },
        });

        await db.skillPackage.create({
            data: {
                id: T.pkg,
                organizationId: T.org,
                name: "Pkg",
                description: "",
                properties: {},
                published: true,
            },
        });
        await db.skillGroup.create({
            data: {
                id: T.grp,
                skillPackageId: T.pkg,
                name: "Group",
                description: "",
                properties: {},
            },
        });
        await db.skill.create({
            data: {
                id: T.skill1,
                skillPackageId: T.pkg,
                skillGroupId: T.grp,
                name: "Skill 1",
                description: "",
                properties: {},
            },
        });
        await db.skill.create({
            data: {
                id: T.skill2,
                skillPackageId: T.pkg,
                skillGroupId: T.grp,
                name: "Skill 2",
                description: "",
                properties: {},
            },
        });
        await db.skill.create({
            data: {
                id: T.skill3,
                skillPackageId: T.pkg,
                skillGroupId: T.grp,
                name: "Skill 3",
                description: "",
                properties: {},
            },
        });

        await db.skillCheckSession.create({
            data: {
                id: T.session,
                organizationId: T.org,
                name: "Scoped Session",
                sessionNumber: 1,
                startsAt: new Date(),
                endsAt: new Date(),
                notes: "",
                assessors: { connect: [{ id: T.assessorPerson }] },
            },
        });
        await db.skillCheckSession.create({
            data: {
                id: T.unscopedSession,
                organizationId: T.org,
                name: "Unscoped Session",
                sessionNumber: 2,
                startsAt: new Date(),
                endsAt: new Date(),
                notes: "",
            },
        });
    });

    function makeCaller(userId: UserId) {
        return skillCheckSessionsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: userId },
                permissions: {
                    organization: ["view"],
                    skillCheckSession: ["update"],
                    skillCheck: ["create"],
                },
                prisma: db,
            }),
        );
    }

    it("allows the assigned assessor to record checks", async () => {
        const result = await makeCaller(T.assessorUser).upsertSessionSkillChecks({
            organizationId: T.org,
            sessionId: T.session,
            updates: [{ assesseeId: T.assessee, skillId: T.skill1, result: "Pass", notes: "" }],
        });

        expect(result.created).toHaveLength(1);
        expect(result.created[0].assessorId).toBe(T.assessorPerson);
    });

    it("rejects an assigned assessor holding only session update, as skills-admin does", async () => {
        const caller = skillCheckSessionsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.assessorUser },
                permissions: { organization: ["view"], skillCheckSession: ["update"] },
                prisma: db,
            }),
        );

        await expect(
            caller.upsertSessionSkillChecks({
                organizationId: T.org,
                sessionId: T.session,
                updates: [{ assesseeId: T.assessee, skillId: T.skill1, result: "Pass", notes: "" }],
            }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("rejects a person who is not an assigned assessor for the session", async () => {
        await expect(
            makeCaller(T.otherUser).upsertSessionSkillChecks({
                organizationId: T.org,
                sessionId: T.session,
                updates: [{ assesseeId: T.assessee, skillId: T.skill1, result: "Pass", notes: "" }],
            }),
        ).rejects.toThrow(TRPCError);
    });

    it("rejects recording on a session with no assigned assessors at all", async () => {
        await expect(
            makeCaller(T.assessorUser).upsertSessionSkillChecks({
                organizationId: T.org,
                sessionId: T.unscopedSession,
                updates: [{ assesseeId: T.assessee, skillId: T.skill1, result: "Pass", notes: "" }],
            }),
        ).rejects.toThrow(TRPCError);
    });

    it("deletes an existing check when result is null, and does nothing if none exists", async () => {
        const caller = makeCaller(T.assessorUser);

        const created = await caller.upsertSessionSkillChecks({
            organizationId: T.org,
            sessionId: T.session,
            updates: [{ assesseeId: T.assessee, skillId: T.skill2, result: "Pass", notes: "" }],
        });
        expect(created.created).toHaveLength(1);

        const cleared = await caller.upsertSessionSkillChecks({
            organizationId: T.org,
            sessionId: T.session,
            updates: [{ assesseeId: T.assessee, skillId: T.skill2, result: null, notes: "" }],
        });
        expect(cleared.deleted).toEqual([{ assesseeId: T.assessee, skillId: T.skill2 }]);

        const remaining = await db.skillCheck.findMany({
            where: { organizationId: T.org, assesseeId: T.assessee, skillId: T.skill2 },
        });
        expect(remaining).toHaveLength(0);

        const noOp = await caller.upsertSessionSkillChecks({
            organizationId: T.org,
            sessionId: T.session,
            updates: [{ assesseeId: T.assessee, skillId: T.skill2, result: null, notes: "" }],
        });
        expect(noOp.deleted).toEqual([{ assesseeId: T.assessee, skillId: T.skill2 }]);
    });
});

describe("skillCheckSessions.createSession", () => {
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
        return skillCheckSessionsRouter.createCaller(
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

describe("skillCheckSessions.listSessions", () => {
    const T = {
        org: OrganizationId.create(),
        user: UserId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Test Org", slug: T.org, createdAt: new Date() },
        });

        await db.skillCheckSession.create({
            data: {
                id: SkillCheckSessionId.create(),
                organizationId: T.org,
                name: "Session A",
                sessionNumber: 1,
                status: "Draft",
                startsAt: new Date(),
                notes: "",
            },
        });
    });

    function makeCaller(
        permissions: Parameters<typeof createAuthenticatedMockContext>[0]["permissions"],
    ) {
        return skillCheckSessionsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions,
                prisma: db,
            }),
        );
    }

    it("succeeds with skillCheckSession:view alone", async () => {
        const sessions = await makeCaller({
            organization: ["view"],
            skillCheckSession: ["view"],
        }).listSessions({ organizationId: T.org });

        expect(sessions).toHaveLength(1);
    });

    it("throws FORBIDDEN with only skillPackageSubscription:view", async () => {
        await expect(
            makeCaller({
                organization: ["view"],
                skillPackageSubscription: ["view"],
            }).listSessions({ organizationId: T.org }),
        ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
});
