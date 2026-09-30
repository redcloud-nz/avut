/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { TRPCError } from "@trpc/server";

import { nanoId16 } from "@/lib/id";
import type { Permissions } from "@/lib/permissions";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheckId } from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { skillCheckSessionsRouter } from "./skill-check-sessions-router";

describe("skillCheckSessions.setSessionSkillCheck + deleteSessionSkillCheck", () => {
    // Dataset:
    //   assessorUser      → linked to assessorPerson, assigned as an assessor of session
    //   secondAssessorUser → linked to secondAssessorPerson, also assigned to session
    //   otherUser         → linked to otherPerson, NOT assigned to session
    //   unlinkedUser      → org member with no linked person
    //   session           → assessees [assessee], skills [skill1, skill2], assessors [assessor, secondAssessor]
    //   outsider          → a person in the org but not an assessee of session
    //   offSessionSkill   → a skill in the org but not one of session's skills
    //   secondAssessorPerson's own check on (assessee, skill2) is seeded directly
    //   approvedSession   → same members as session, status Include, with the caller's
    //                       approvedCheck on (assessee, skill1)
    const T = {
        org: OrganizationId.create(),
        assessorUser: UserId.create(),
        secondAssessorUser: UserId.create(),
        otherUser: UserId.create(),
        unlinkedUser: UserId.create(),
        assessorPerson: PersonId.create(),
        secondAssessorPerson: PersonId.create(),
        otherPerson: PersonId.create(),
        assessee: PersonId.create(),
        outsider: PersonId.create(),
        pkg: SkillPackageId.create(),
        grp: SkillGroupId.create(),
        skill1: SkillId.create(),
        skill2: SkillId.create(),
        offSessionSkill: SkillId.create(),
        session: SkillCheckSessionId.create(),
        secondAssessorCheck: SkillCheckId.create(),
        approvedSession: SkillCheckSessionId.create(),
        approvedCheck: SkillCheckId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Test Org", slug: T.org, createdAt: new Date() },
        });

        for (const [id, name] of [
            [T.assessorPerson, "Assessor"],
            [T.secondAssessorPerson, "Second Assessor"],
            [T.otherPerson, "Other"],
            [T.assessee, "Assessee"],
            [T.outsider, "Outsider"],
        ] as const) {
            await db.person.create({
                data: { id, organizationId: T.org, name, email: `${id}@example.com` },
            });
        }

        for (const [userId, personId] of [
            [T.assessorUser, T.assessorPerson],
            [T.secondAssessorUser, T.secondAssessorPerson],
            [T.otherUser, T.otherPerson],
            [T.unlinkedUser, null],
        ] as const) {
            await db.organizationUser.create({
                data: { id: nanoId16(), organizationId: T.org, userId, role: "member", personId },
            });
        }

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
        for (const [id, name] of [
            [T.skill1, "Skill 1"],
            [T.skill2, "Skill 2"],
            [T.offSessionSkill, "Off-session Skill"],
        ] as const) {
            await db.skill.create({
                data: {
                    id,
                    skillPackageId: T.pkg,
                    skillGroupId: T.grp,
                    name,
                    description: "",
                    properties: {},
                },
            });
        }

        await db.skillCheckSession.create({
            data: {
                id: T.session,
                organizationId: T.org,
                name: "Session",
                sessionNumber: 1,
                startsAt: new Date(),
                endsAt: new Date(),
                notes: "",
                assessors: {
                    connect: [{ id: T.assessorPerson }, { id: T.secondAssessorPerson }],
                },
                assessees: { connect: [{ id: T.assessee }] },
                skills: { connect: [{ id: T.skill1 }, { id: T.skill2 }] },
            },
        });

        await db.skillCheck.create({
            data: {
                id: T.secondAssessorCheck,
                organizationId: T.org,
                sessionId: T.session,
                assesseeId: T.assessee,
                assessorId: T.secondAssessorPerson,
                skillId: T.skill2,
                result: "Fail",
                notes: "Second assessor's check",
            },
        });

        await db.skillCheckSession.create({
            data: {
                id: T.approvedSession,
                organizationId: T.org,
                name: "Approved Session",
                sessionNumber: 2,
                status: "Include",
                startsAt: new Date(),
                endsAt: new Date(),
                notes: "",
                assessors: {
                    connect: [{ id: T.assessorPerson }, { id: T.secondAssessorPerson }],
                },
                assessees: { connect: [{ id: T.assessee }] },
                skills: { connect: [{ id: T.skill1 }, { id: T.skill2 }] },
            },
        });
        await db.skillCheck.create({
            data: {
                id: T.approvedCheck,
                organizationId: T.org,
                sessionId: T.approvedSession,
                assesseeId: T.assessee,
                assessorId: T.assessorPerson,
                skillId: T.skill1,
                result: "Pass",
                notes: "",
                status: "Include",
            },
        });
    });

    function makeCaller(
        userId: UserId,
        permissions: Permissions = {
            organization: ["view"],
            skillCheckSession: ["update"],
            skillCheck: ["create"],
        },
    ) {
        return skillCheckSessionsRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: userId }, permissions, prisma: db }),
        );
    }

    const target = {
        organizationId: T.org,
        skillCheckSessionId: T.session,
        assesseeId: T.assessee,
    };

    describe("setSessionSkillCheck", () => {
        it("creates the caller's check, then updates the same row", async () => {
            const caller = makeCaller(T.assessorUser);

            const created = await caller.setSessionSkillCheck({
                ...target,
                skillId: T.skill1,
                result: "Pass",
                notes: "",
            });
            expect(created).toMatchObject({
                sessionId: T.session,
                assesseeId: T.assessee,
                assessorId: T.assessorPerson,
                skillId: T.skill1,
                result: "Pass",
                notes: "",
                status: "Draft",
            });

            const updated = await caller.setSessionSkillCheck({
                ...target,
                skillId: T.skill1,
                result: "Fail",
                notes: "Try again",
            });
            expect(updated.id).toBe(created.id);
            expect(updated).toMatchObject({ result: "Fail", notes: "Try again" });

            const rows = await db.skillCheck.findMany({
                where: { sessionId: T.session, assesseeId: T.assessee, skillId: T.skill1 },
            });
            expect(rows).toHaveLength(1);
        });

        it("rejects a user who is not an assigned assessor with FORBIDDEN", async () => {
            await expect(
                makeCaller(T.otherUser).setSessionSkillCheck({
                    ...target,
                    skillId: T.skill1,
                    result: "Pass",
                    notes: "",
                }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        });

        it("rejects a user with no linked person with BAD_REQUEST", async () => {
            await expect(
                makeCaller(T.unlinkedUser).setSessionSkillCheck({
                    ...target,
                    skillId: T.skill1,
                    result: "Pass",
                    notes: "",
                }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        });

        it("rejects an assessee who is not on the session with BAD_REQUEST", async () => {
            await expect(
                makeCaller(T.assessorUser).setSessionSkillCheck({
                    ...target,
                    assesseeId: T.outsider,
                    skillId: T.skill1,
                    result: "Pass",
                    notes: "",
                }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        });

        it("rejects a skill that is not in the session with BAD_REQUEST", async () => {
            await expect(
                makeCaller(T.assessorUser).setSessionSkillCheck({
                    ...target,
                    skillId: T.offSessionSkill,
                    result: "Pass",
                    notes: "",
                }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        });

        it("refuses a check in an approved session with CONFLICT and leaves it unchanged", async () => {
            await expect(
                makeCaller(T.assessorUser).setSessionSkillCheck({
                    ...target,
                    skillCheckSessionId: T.approvedSession,
                    skillId: T.skill1,
                    result: "Fail",
                    notes: "Changed my mind",
                }),
            ).rejects.toMatchObject({ code: "CONFLICT" });

            const check = await db.skillCheck.findUnique({ where: { id: T.approvedCheck } });
            expect(check).toMatchObject({ result: "Pass", status: "Include" });
        });

        it("is refused for a role lacking skillCheck create, as skills-admin is", async () => {
            await expect(
                makeCaller(T.assessorUser, {
                    organization: ["view"],
                    skillCheckSession: ["update"],
                }).setSessionSkillCheck({
                    ...target,
                    skillId: T.skill1,
                    result: "Pass",
                    notes: "",
                }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        });
    });

    describe("deleteSessionSkillCheck", () => {
        it("tombstones the caller's own check and leaves another assessor's check alone", async () => {
            const caller = makeCaller(T.assessorUser);
            const recorded = await caller.setSessionSkillCheck({
                ...target,
                skillId: T.skill2,
                result: "Pass",
                notes: "",
            });

            const result = await caller.deleteSessionSkillCheck({ ...target, skillId: T.skill2 });
            expect(result).toEqual({ deleted: true });

            const remaining = await db.skillCheck.findMany({
                where: { sessionId: T.session, assesseeId: T.assessee, skillId: T.skill2 },
            });
            expect(
                remaining
                    .map(({ id, status }) => ({ id, status }))
                    .sort((a, b) => a.id.localeCompare(b.id)),
            ).toEqual(
                [
                    { id: recorded.id, status: "Deleted" },
                    { id: T.secondAssessorCheck, status: "Draft" },
                ].sort((a, b) => a.id.localeCompare(b.id)),
            );

            // Nothing live is left on the caller's key, so a second delete finds nothing.
            expect(await caller.deleteSessionSkillCheck({ ...target, skillId: T.skill2 })).toEqual({
                deleted: false,
            });
        });

        it("returns deleted: false when the caller has no check to delete", async () => {
            const result = await makeCaller(T.assessorUser).deleteSessionSkillCheck({
                ...target,
                skillId: T.skill2,
            });

            expect(result).toEqual({ deleted: false });
        });

        it("rejects a user who is not an assigned assessor with FORBIDDEN", async () => {
            await expect(
                makeCaller(T.otherUser).deleteSessionSkillCheck({ ...target, skillId: T.skill2 }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        });

        it("refuses a check in an approved session with CONFLICT and keeps it", async () => {
            await expect(
                makeCaller(T.assessorUser).deleteSessionSkillCheck({
                    ...target,
                    skillCheckSessionId: T.approvedSession,
                    skillId: T.skill1,
                }),
            ).rejects.toMatchObject({ code: "CONFLICT" });

            expect(
                await db.skillCheck.findUnique({ where: { id: T.approvedCheck } }),
            ).not.toBeNull();
        });

        it("rejects a skill that is not in the session with BAD_REQUEST", async () => {
            await expect(
                makeCaller(T.assessorUser).deleteSessionSkillCheck({
                    ...target,
                    skillId: T.offSessionSkill,
                }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        });

        it("rejects an assessee who is not on the session with BAD_REQUEST", async () => {
            await expect(
                makeCaller(T.assessorUser).deleteSessionSkillCheck({
                    ...target,
                    assesseeId: T.outsider,
                    skillId: T.skill2,
                }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        });
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
            },
        });

        expect(created.assessors).toEqual([{ id: T.linkedPerson, name: "Alice Anderson" }]);
        expect(created.status).toBe("Draft");
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
            },
        });
        const { created: second } = await makeCaller(T.linkedUser).createSession({
            organizationId: T.org,
            skillCheckSessionId: SkillCheckSessionId.create(),
            create: {
                name: "Session D",
                date: new Date().toISOString(),
                notes: "",
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
            create: { name: "", date: new Date().toISOString(), notes: "" },
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

describe("skillCheckSessions reads ignore Deleted checks", () => {
    // Dataset:
    //   session → assigned: assessee [liveAssessee], skills [liveSkill], assessors [liveAssessor]
    //   liveCheck    → (liveAssessee, liveSkill, liveAssessor), Draft
    //   deletedCheck → (goneAssessee, goneSkill, goneAssessor), Deleted — none of the three
    //                  is assigned, so they'd only surface through the tombstone
    const T = {
        org: OrganizationId.create(),
        user: UserId.create(),
        liveAssessee: PersonId.create(),
        goneAssessee: PersonId.create(),
        liveAssessor: PersonId.create(),
        goneAssessor: PersonId.create(),
        pkg: SkillPackageId.create(),
        grp: SkillGroupId.create(),
        liveSkill: SkillId.create(),
        goneSkill: SkillId.create(),
        session: SkillCheckSessionId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Test Org", slug: T.org, createdAt: new Date() },
        });

        for (const [id, name] of [
            [T.liveAssessee, "Live Assessee"],
            [T.goneAssessee, "Gone Assessee"],
            [T.liveAssessor, "Live Assessor"],
            [T.goneAssessor, "Gone Assessor"],
        ] as const) {
            await db.person.create({
                data: { id, organizationId: T.org, name, email: `${id}@example.com` },
            });
        }

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
        for (const [id, name] of [
            [T.liveSkill, "Live Skill"],
            [T.goneSkill, "Gone Skill"],
        ] as const) {
            await db.skill.create({
                data: {
                    id,
                    skillPackageId: T.pkg,
                    skillGroupId: T.grp,
                    name,
                    description: "",
                    properties: {},
                },
            });
        }

        await db.skillCheckSession.create({
            data: {
                id: T.session,
                organizationId: T.org,
                name: "Session",
                sessionNumber: 1,
                status: "Draft",
                startsAt: new Date(),
                notes: "",
                assessors: { connect: [{ id: T.liveAssessor }] },
                assessees: { connect: [{ id: T.liveAssessee }] },
                skills: { connect: [{ id: T.liveSkill }] },
            },
        });

        for (const [assesseeId, skillId, assessorId, status] of [
            [T.liveAssessee, T.liveSkill, T.liveAssessor, "Draft"],
            [T.goneAssessee, T.goneSkill, T.goneAssessor, "Deleted"],
        ] as const) {
            await db.skillCheck.create({
                data: {
                    id: SkillCheckId.create(),
                    organizationId: T.org,
                    sessionId: T.session,
                    assesseeId,
                    skillId,
                    assessorId,
                    result: "Pass",
                    notes: "",
                    status,
                },
            });
        }
    });

    function makeCaller() {
        return skillCheckSessionsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"], skillCheckSession: ["view"] },
                prisma: db,
            }),
        );
    }

    it("getSessionMetrics counts only the live check", async () => {
        const metrics = await makeCaller().getSessionMetrics({
            organizationId: T.org,
            skillCheckSessionId: T.session,
        });

        expect(metrics).toEqual({ assesseeCount: 1, skillCount: 1, checkCount: 1 });
    });

    it('listSessionAssessees "all" leaves out an assessee known only from a Deleted check', async () => {
        const assessees = await makeCaller().listSessionAssessees({
            organizationId: T.org,
            sessionId: T.session,
            scope: "all",
        });

        expect(assessees.map((p) => p.id)).toEqual([T.liveAssessee]);
    });

    it('listSessionAssessors "all" leaves out an assessor known only from a Deleted check', async () => {
        const assessors = await makeCaller().listSessionAssessors({
            organizationId: T.org,
            sessionId: T.session,
            scope: "all",
        });

        expect(assessors.map((p) => p.id)).toEqual([T.liveAssessor]);
    });

    it('listSessionSkills "all" leaves out a skill known only from a Deleted check', async () => {
        const skills = await makeCaller().listSessionSkills({
            organizationId: T.org,
            sessionId: T.session,
            scope: "all",
        });

        expect(skills.map((s) => s.id)).toEqual([T.liveSkill]);
    });
});

describe("skillCheckSessions.updateSessionAssessors + listEligibleAssessors", () => {
    // Dataset (every person is linked to an org user):
    //   assessor   → "skills-assessor"          → eligible
    //   multiRole  → "member,skills-assessor"   → eligible
    //   memberOnly → "member"                   → ineligible
    //   lapsed     → "member", yet assigned to lapsedSession (has since lost the role)
    // Each test works on its own session so they don't depend on each other's writes.
    const T = {
        org: OrganizationId.create(),
        user: UserId.create(),
        assessor: PersonId.create(),
        multiRole: PersonId.create(),
        memberOnly: PersonId.create(),
        lapsed: PersonId.create(),
        addRemoveSession: SkillCheckSessionId.create(),
        multiRoleSession: SkillCheckSessionId.create(),
        rejectSession: SkillCheckSessionId.create(),
        lapsedSession: SkillCheckSessionId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Test Org", slug: T.org, createdAt: new Date() },
        });

        const people = [
            { id: T.assessor, name: "Assessor", role: "skills-assessor" },
            { id: T.multiRole, name: "Multi Role", role: "member,skills-assessor" },
            { id: T.memberOnly, name: "Member Only", role: "member" },
            { id: T.lapsed, name: "Lapsed", role: "member" },
        ];
        for (const { id, name, role } of people) {
            await db.person.create({
                data: { id, organizationId: T.org, name, email: `${id}@example.com` },
            });
            await db.organizationUser.create({
                data: {
                    id: nanoId16(),
                    organizationId: T.org,
                    userId: UserId.create(),
                    role,
                    personId: id,
                },
            });
        }

        const sessions = [
            { id: T.addRemoveSession, sessionNumber: 1, assessors: [T.multiRole] },
            { id: T.multiRoleSession, sessionNumber: 2, assessors: [] },
            { id: T.rejectSession, sessionNumber: 3, assessors: [T.assessor] },
            { id: T.lapsedSession, sessionNumber: 4, assessors: [T.lapsed, T.assessor] },
        ];
        for (const { id, sessionNumber, assessors } of sessions) {
            await db.skillCheckSession.create({
                data: {
                    id,
                    organizationId: T.org,
                    name: `Session ${sessionNumber}`,
                    sessionNumber,
                    startsAt: new Date(),
                    notes: "",
                    assessors: { connect: assessors.map((personId) => ({ id: personId })) },
                },
            });
        }
    });

    function makeCaller() {
        return skillCheckSessionsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"], skillCheckSession: ["update"] },
                prisma: db,
            }),
        );
    }

    async function assignedAssessorIds(sessionId: SkillCheckSessionId) {
        const session = await db.skillCheckSession.findUnique({
            where: { id: sessionId },
            include: { assessors: { select: { id: true } } },
        });
        return (session?.assessors ?? []).map((person) => person.id).sort();
    }

    // prisma-mock doesn't apply `disconnect` to an implicit many-to-many relation, so removals
    // are asserted on the update the router sends (plus its log entry) rather than on DB state.
    function spyOnSessionUpdate() {
        return vi.spyOn(db.skillCheckSession, "update");
    }

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("adds an eligible person, removes an assigned one, and logs the change", async () => {
        const update = spyOnSessionUpdate();

        const result = await makeCaller().updateSessionAssessors({
            organizationId: T.org,
            skillCheckSessionId: T.addRemoveSession,
            addedPersonIds: [T.assessor],
            removedPersonIds: [T.multiRole],
        });

        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: T.addRemoveSession, organizationId: T.org },
                data: {
                    assessors: {
                        connect: [{ id: T.assessor }],
                        disconnect: [{ id: T.multiRole }],
                    },
                },
            }),
        );
        expect(result.updatedSession.id).toBe(T.addRemoveSession);
        expect(result.updatedAssessors).toContainEqual({ id: T.assessor, name: "Assessor" });
        expect(await assignedAssessorIds(T.addRemoveSession)).toContain(T.assessor);

        const entries = await db.logEntry.findMany({
            where: {
                objectType: "SkillCheckSession",
                objectId: T.addRemoveSession,
                action: "Update",
            },
        });
        expect(entries).toHaveLength(1);
        expect(entries[0].changes).toEqual([
            { path: ["assessors"], type: "arr_add", value: T.assessor },
            { path: ["assessors"], type: "arr_del", value: T.multiRole },
        ]);
    });

    it("accepts a person whose stored role lists skills-assessor among several", async () => {
        const result = await makeCaller().updateSessionAssessors({
            organizationId: T.org,
            skillCheckSessionId: T.multiRoleSession,
            addedPersonIds: [T.multiRole],
            removedPersonIds: [],
        });

        expect(result.updatedAssessors).toEqual([{ id: T.multiRole, name: "Multi Role" }]);
    });

    it("rejects adding an ineligible person with BAD_REQUEST and changes nothing", async () => {
        const update = spyOnSessionUpdate();

        await expect(
            makeCaller().updateSessionAssessors({
                organizationId: T.org,
                skillCheckSessionId: T.rejectSession,
                addedPersonIds: [T.memberOnly],
                removedPersonIds: [T.assessor],
            }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });

        expect(update).not.toHaveBeenCalled();
        expect(await assignedAssessorIds(T.rejectSession)).toEqual([T.assessor]);
        const entries = await db.logEntry.findMany({
            where: { objectType: "SkillCheckSession", objectId: T.rejectSession },
        });
        expect(entries).toHaveLength(0);
    });

    it("listEligibleAssessors needs only skillCheckSession:view", async () => {
        const caller = skillCheckSessionsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"], skillCheckSession: ["view"] },
                prisma: db,
            }),
        );

        expect(await caller.listEligibleAssessors({ organizationId: T.org })).toEqual([
            { id: T.assessor, name: "Assessor" },
            { id: T.multiRole, name: "Multi Role" },
        ]);
    });

    it("allows removing an assessor who is no longer eligible", async () => {
        const update = spyOnSessionUpdate();

        await makeCaller().updateSessionAssessors({
            organizationId: T.org,
            skillCheckSessionId: T.lapsedSession,
            addedPersonIds: [],
            removedPersonIds: [T.lapsed],
        });

        expect(update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: { assessors: { connect: [], disconnect: [{ id: T.lapsed }] } },
            }),
        );
        const entries = await db.logEntry.findMany({
            where: { objectType: "SkillCheckSession", objectId: T.lapsedSession },
        });
        expect(entries).toHaveLength(1);
        expect(entries[0].changes).toEqual([
            { path: ["assessors"], type: "arr_del", value: T.lapsed },
        ]);
    });
});

describe("skillCheckSessions approval lock on configuration and approval", () => {
    // Dataset:
    //   draftSession    → Draft, the lock doesn't apply
    //   approvedSession → Include, every guarded procedure refuses with CONFLICT
    //   toApprove       → Draft, with one check, approved by the "approves a Draft session" test
    //   racedSession    → Draft, no checks (for the lost-race test)
    //   person          → an eligible assessor (skills-assessor), also used as an assessee
    const T = {
        org: OrganizationId.create(),
        user: UserId.create(),
        person: PersonId.create(),
        pkg: SkillPackageId.create(),
        grp: SkillGroupId.create(),
        skill: SkillId.create(),
        draftSession: SkillCheckSessionId.create(),
        approvedSession: SkillCheckSessionId.create(),
        toApprove: SkillCheckSessionId.create(),
        toApproveCheck: SkillCheckId.create(),
        racedSession: SkillCheckSessionId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Test Org", slug: T.org, createdAt: new Date() },
        });
        await db.person.create({
            data: {
                id: T.person,
                organizationId: T.org,
                name: "Assessor",
                email: `${T.person}@example.com`,
            },
        });
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: UserId.create(),
                role: "skills-assessor",
                personId: T.person,
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
                id: T.skill,
                skillPackageId: T.pkg,
                skillGroupId: T.grp,
                name: "Skill",
                description: "",
                properties: {},
            },
        });

        const sessions = [
            { id: T.draftSession, sessionNumber: 1, status: "Draft" },
            { id: T.approvedSession, sessionNumber: 2, status: "Include" },
            { id: T.toApprove, sessionNumber: 3, status: "Draft" },
            { id: T.racedSession, sessionNumber: 4, status: "Draft" },
        ] as const;
        for (const { id, sessionNumber, status } of sessions) {
            await db.skillCheckSession.create({
                data: {
                    id,
                    organizationId: T.org,
                    name: `Session ${sessionNumber}`,
                    sessionNumber,
                    status,
                    startsAt: new Date(),
                    endsAt: new Date(),
                    notes: "",
                },
            });
        }
        await db.skillCheck.create({
            data: {
                id: T.toApproveCheck,
                organizationId: T.org,
                sessionId: T.toApprove,
                assesseeId: T.person,
                assessorId: T.person,
                skillId: T.skill,
                result: "Pass",
                notes: "",
            },
        });
    });

    function makeCaller() {
        return skillCheckSessionsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: {
                    organization: ["view"],
                    skillCheckSession: ["update", "approve"],
                },
                prisma: db,
            }),
        );
    }

    const guarded = {
        updateSessionAssessees: (sessionId: SkillCheckSessionId) =>
            makeCaller().updateSessionAssessees({
                organizationId: T.org,
                skillCheckSessionId: sessionId,
                addedPersonIds: [T.person],
                removedPersonIds: [],
            }),
        updateSessionSkills: (sessionId: SkillCheckSessionId) =>
            makeCaller().updateSessionSkills({
                organizationId: T.org,
                skillCheckSessionId: sessionId,
                addedSkillIds: [T.skill],
                removedSkillIds: [],
            }),
        updateSessionAssessors: (sessionId: SkillCheckSessionId) =>
            makeCaller().updateSessionAssessors({
                organizationId: T.org,
                skillCheckSessionId: sessionId,
                addedPersonIds: [T.person],
                removedPersonIds: [],
            }),
    };

    for (const [name, call] of Object.entries(guarded)) {
        describe(name, () => {
            it("refuses an approved session with CONFLICT", async () => {
                await expect(call(T.approvedSession)).rejects.toMatchObject({ code: "CONFLICT" });
            });

            it("works on a Draft session", async () => {
                const result = await call(T.draftSession);
                expect(result.updatedSession.id).toBe(T.draftSession);
            });
        });
    }

    describe("approveSession", () => {
        it("refuses an already-approved session with CONFLICT", async () => {
            await expect(
                makeCaller().approveSession({
                    organizationId: T.org,
                    sessionId: T.approvedSession,
                    includedCheckIds: [],
                }),
            ).rejects.toMatchObject({ code: "CONFLICT" });
        });

        it("approves a Draft session", async () => {
            const { updated } = await makeCaller().approveSession({
                organizationId: T.org,
                sessionId: T.toApprove,
                includedCheckIds: [T.toApproveCheck],
            });

            expect(updated.status).toBe("Include");
            const check = await db.skillCheck.findUnique({ where: { id: T.toApproveCheck } });
            expect(check?.status).toBe("Include");
        });

        it("throws NOT_FOUND for an unknown session", async () => {
            await expect(
                makeCaller().approveSession({
                    organizationId: T.org,
                    sessionId: SkillCheckSessionId.create(),
                    includedCheckIds: [],
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
        });

        it("reports a session approved after the pre-check (P2025) as CONFLICT", async () => {
            // prisma-mock can't interleave a concurrent approval, so fake the lost race's error.
            const spy = vi
                .spyOn(db.skillCheckSession, "update")
                .mockRejectedValueOnce(
                    Object.assign(new Error("Record to update not found."), { code: "P2025" }),
                );
            try {
                await expect(
                    makeCaller().approveSession({
                        organizationId: T.org,
                        sessionId: T.racedSession,
                        includedCheckIds: [],
                    }),
                ).rejects.toMatchObject({ code: "CONFLICT" });
            } finally {
                spy.mockRestore();
            }
        });
    });

    describe("updateSession", () => {
        it("still edits an approved session's name, date and notes", async () => {
            const { updated } = await makeCaller().updateSession({
                organizationId: T.org,
                skillCheckSessionId: T.approvedSession,
                update: { name: "Renamed", date: new Date().toISOString(), notes: "After" },
            });

            expect(updated).toMatchObject({ name: "Renamed", notes: "After", status: "Include" });
        });
    });
});

describe("skillCheckSessions tombstones", () => {
    // Dataset:
    //   user → linked to assessor, an assigned assessor of every session below
    //   session → Draft; assessee × [skillA, skillB, skillC]
    //     pendingCheck   (assessee, skillA) Pending, recorded a year ago
    //     tombstoneCheck (assessee, skillB) Deleted, recorded a year ago
    //     skillC has no check
    //   approveSession → Draft; liveCheck (assessee, skillA) + deadCheck (assessee, skillB) Deleted
    //   doomedSession  → Draft; doomedDeadCheck (assessee, skillA) Deleted
    const T = {
        org: OrganizationId.create(),
        user: UserId.create(),
        assessor: PersonId.create(),
        assessee: PersonId.create(),
        pkg: SkillPackageId.create(),
        grp: SkillGroupId.create(),
        skillA: SkillId.create(),
        skillB: SkillId.create(),
        skillC: SkillId.create(),
        session: SkillCheckSessionId.create(),
        pendingCheck: SkillCheckId.create(),
        tombstoneCheck: SkillCheckId.create(),
        approveSession: SkillCheckSessionId.create(),
        liveCheck: SkillCheckId.create(),
        deadCheck: SkillCheckId.create(),
        doomedSession: SkillCheckSessionId.create(),
        doomedDeadCheck: SkillCheckId.create(),
    };
    const aYearAgo = new Date("2025-09-30T00:00:00.000Z");

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Test Org", slug: T.org, createdAt: new Date() },
        });
        for (const [id, name] of [
            [T.assessor, "Assessor"],
            [T.assessee, "Assessee"],
        ] as const) {
            await db.person.create({
                data: { id, organizationId: T.org, name, email: `${id}@example.com` },
            });
        }
        await db.organizationUser.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                userId: T.user,
                role: "member",
                personId: T.assessor,
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
        for (const [id, name] of [
            [T.skillA, "Skill A"],
            [T.skillB, "Skill B"],
            [T.skillC, "Skill C"],
        ] as const) {
            await db.skill.create({
                data: {
                    id,
                    skillPackageId: T.pkg,
                    skillGroupId: T.grp,
                    name,
                    description: "",
                    properties: {},
                },
            });
        }

        for (const [id, sessionNumber] of [
            [T.session, 1],
            [T.approveSession, 2],
            [T.doomedSession, 3],
        ] as const) {
            await db.skillCheckSession.create({
                data: {
                    id,
                    organizationId: T.org,
                    name: `Session ${sessionNumber}`,
                    sessionNumber,
                    startsAt: new Date(),
                    endsAt: new Date(),
                    notes: "",
                    assessors: { connect: [{ id: T.assessor }] },
                    assessees: { connect: [{ id: T.assessee }] },
                    skills: { connect: [{ id: T.skillA }, { id: T.skillB }, { id: T.skillC }] },
                },
            });
        }

        const checks = [
            [T.pendingCheck, T.session, T.skillA, "Pending"],
            [T.tombstoneCheck, T.session, T.skillB, "Deleted"],
            [T.liveCheck, T.approveSession, T.skillA, "Draft"],
            [T.deadCheck, T.approveSession, T.skillB, "Deleted"],
            [T.doomedDeadCheck, T.doomedSession, T.skillA, "Deleted"],
        ] as const;
        for (const [id, sessionId, skillId, status] of checks) {
            await db.skillCheck.create({
                data: {
                    id,
                    organizationId: T.org,
                    sessionId,
                    assesseeId: T.assessee,
                    assessorId: T.assessor,
                    skillId,
                    result: "Pass",
                    notes: "Old notes",
                    status,
                    createdAt: aYearAgo,
                },
            });
        }
    });

    function makeCaller() {
        return skillCheckSessionsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: {
                    organization: ["view"],
                    skillCheckSession: ["update", "approve", "delete"],
                    skillCheck: ["create"],
                },
                prisma: db,
            }),
        );
    }

    const target = {
        organizationId: T.org,
        skillCheckSessionId: T.session,
        assesseeId: T.assessee,
    };

    it("re-recording over a tombstone revives the same row as Draft with a new createdAt", async () => {
        const revived = await makeCaller().setSessionSkillCheck({
            ...target,
            skillId: T.skillB,
            result: "Fail",
            notes: "Again",
        });

        expect(revived).toMatchObject({
            id: T.tombstoneCheck,
            status: "Draft",
            result: "Fail",
            notes: "Again",
        });
        expect(new Date(revived.createdAt).getTime()).toBeGreaterThan(aYearAgo.getTime());
    });

    it("re-recording over a live Pending check makes it Draft and keeps its createdAt", async () => {
        const updated = await makeCaller().setSessionSkillCheck({
            ...target,
            skillId: T.skillA,
            result: "Fail",
            notes: "Changed",
        });

        expect(updated).toMatchObject({ id: T.pendingCheck, status: "Draft", result: "Fail" });
        expect(updated.createdAt).toBe(aYearAgo.toISOString());
    });

    it("deleting and re-recording a check brings back the same row", async () => {
        const caller = makeCaller();
        const recorded = await caller.setSessionSkillCheck({
            ...target,
            skillId: T.skillC,
            result: "Pass",
            notes: "",
        });

        expect(await caller.deleteSessionSkillCheck({ ...target, skillId: T.skillC })).toEqual({
            deleted: true,
        });
        const again = await caller.setSessionSkillCheck({
            ...target,
            skillId: T.skillC,
            result: "Pass",
            notes: "Undo",
        });

        expect(again).toMatchObject({ id: recorded.id, status: "Draft", notes: "Undo" });
    });

    it("approveSession purges the session's Deleted rows before stamping", async () => {
        await makeCaller().approveSession({
            organizationId: T.org,
            sessionId: T.approveSession,
            includedCheckIds: [T.liveCheck],
        });

        const rows = await db.skillCheck.findMany({ where: { sessionId: T.approveSession } });
        expect(rows.map(({ id, status }) => ({ id, status }))).toEqual([
            { id: T.liveCheck, status: "Include" },
        ]);
    });

    it("deleteSession purges the session's Deleted rows rather than orphaning them", async () => {
        await makeCaller().deleteSession({
            organizationId: T.org,
            skillCheckSessionId: T.doomedSession,
        });

        expect(await db.skillCheck.findUnique({ where: { id: T.doomedDeadCheck } })).toBeNull();
    });
});

describe("skillCheckSessions.reopenSession", () => {
    // Dataset:
    //   approvedSession → Include; includedCheck (skillA) Include, excludedCheck (skillB) Exclude
    //   draftSession    → Draft, no checks
    //   racedSession    → Include, no checks (for the lost-race test)
    const T = {
        org: OrganizationId.create(),
        user: UserId.create(),
        assessor: PersonId.create(),
        assessee: PersonId.create(),
        pkg: SkillPackageId.create(),
        grp: SkillGroupId.create(),
        skillA: SkillId.create(),
        skillB: SkillId.create(),
        approvedSession: SkillCheckSessionId.create(),
        includedCheck: SkillCheckId.create(),
        excludedCheck: SkillCheckId.create(),
        draftSession: SkillCheckSessionId.create(),
        racedSession: SkillCheckSessionId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Test Org", slug: T.org, createdAt: new Date() },
        });
        for (const [id, name] of [
            [T.assessor, "Assessor"],
            [T.assessee, "Assessee"],
        ] as const) {
            await db.person.create({
                data: { id, organizationId: T.org, name, email: `${id}@example.com` },
            });
        }
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
        for (const [id, name] of [
            [T.skillA, "Skill A"],
            [T.skillB, "Skill B"],
        ] as const) {
            await db.skill.create({
                data: {
                    id,
                    skillPackageId: T.pkg,
                    skillGroupId: T.grp,
                    name,
                    description: "",
                    properties: {},
                },
            });
        }

        for (const [id, sessionNumber, status] of [
            [T.approvedSession, 1, "Include"],
            [T.draftSession, 2, "Draft"],
            [T.racedSession, 3, "Include"],
        ] as const) {
            await db.skillCheckSession.create({
                data: {
                    id,
                    organizationId: T.org,
                    name: `Session ${sessionNumber}`,
                    sessionNumber,
                    startsAt: new Date(),
                    endsAt: new Date(),
                    notes: "",
                    status,
                    assessors: { connect: [{ id: T.assessor }] },
                    assessees: { connect: [{ id: T.assessee }] },
                    skills: { connect: [{ id: T.skillA }, { id: T.skillB }] },
                },
            });
        }

        for (const [id, skillId, status] of [
            [T.includedCheck, T.skillA, "Include"],
            [T.excludedCheck, T.skillB, "Exclude"],
        ] as const) {
            await db.skillCheck.create({
                data: {
                    id,
                    organizationId: T.org,
                    sessionId: T.approvedSession,
                    assesseeId: T.assessee,
                    assessorId: T.assessor,
                    skillId,
                    result: "Pass",
                    notes: "",
                    status,
                },
            });
        }
    });

    function makeCaller() {
        return skillCheckSessionsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"], skillCheckSession: ["approve"] },
                prisma: db,
            }),
        );
    }

    async function checkStatuses() {
        const rows = await db.skillCheck.findMany({ where: { sessionId: T.approvedSession } });
        return Object.fromEntries(rows.map((row) => [row.id, row.status]));
    }

    it("refuses a Draft session with CONFLICT", async () => {
        await expect(
            makeCaller().reopenSession({
                organizationId: T.org,
                skillCheckSessionId: T.draftSession,
            }),
        ).rejects.toMatchObject({ code: "CONFLICT" });
    });

    it("throws NOT_FOUND for an unknown session", async () => {
        await expect(
            makeCaller().reopenSession({
                organizationId: T.org,
                skillCheckSessionId: SkillCheckSessionId.create(),
            }),
        ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("reports a session un-approved after the pre-check (P2025) as CONFLICT", async () => {
        // prisma-mock can't interleave a concurrent reopen, so fake the lost race's error.
        const spy = vi
            .spyOn(db.skillCheckSession, "update")
            .mockRejectedValueOnce(
                Object.assign(new Error("Record to update not found."), { code: "P2025" }),
            );
        try {
            await expect(
                makeCaller().reopenSession({
                    organizationId: T.org,
                    skillCheckSessionId: T.racedSession,
                }),
            ).rejects.toMatchObject({ code: "CONFLICT" });
        } finally {
            spy.mockRestore();
        }
    });

    it("moves the session to Draft and its Include checks to Pending, leaving Exclude, logs Reopen, and lets it be approved again", async () => {
        const caller = makeCaller();
        const { updated } = await caller.reopenSession({
            organizationId: T.org,
            skillCheckSessionId: T.approvedSession,
        });

        expect(updated).toMatchObject({ id: T.approvedSession, status: "Draft" });
        const session = await db.skillCheckSession.findUnique({
            where: { id: T.approvedSession },
        });
        expect(session?.status).toBe("Draft");
        expect(await checkStatuses()).toEqual({
            [T.includedCheck]: "Pending",
            [T.excludedCheck]: "Exclude",
        });
        const entries = await db.logEntry.findMany({
            where: {
                objectType: "SkillCheckSession",
                objectId: T.approvedSession,
                action: "Reopen",
            },
        });
        expect(entries).toHaveLength(1);

        const { updated: reapproved } = await caller.approveSession({
            organizationId: T.org,
            sessionId: T.approvedSession,
            includedCheckIds: [T.excludedCheck],
        });

        expect(reapproved.status).toBe("Include");
        expect(await checkStatuses()).toEqual({
            [T.includedCheck]: "Exclude",
            [T.excludedCheck]: "Include",
        });
    });
});

describe("skillCheckSessions.approveSession conflicts", () => {
    // Dataset: assessorA and assessorB may both assess assessee on skill in every session below.
    //   conflictSession → Draft; checkA (assessorA) + checkB (assessorB), both Draft
    //   deletedSession  → Draft; liveCheck (assessorA) Draft + deadCheck (assessorB) Deleted
    //   ownSession      → Draft; ownCheck (assessorA) Draft
    //   foreignSession  → Draft; foreignCheck (assessorB) Draft, same assessee and skill
    const T = {
        org: OrganizationId.create(),
        user: UserId.create(),
        assessorA: PersonId.create(),
        assessorB: PersonId.create(),
        assessee: PersonId.create(),
        pkg: SkillPackageId.create(),
        grp: SkillGroupId.create(),
        skill: SkillId.create(),
        conflictSession: SkillCheckSessionId.create(),
        checkA: SkillCheckId.create(),
        checkB: SkillCheckId.create(),
        deletedSession: SkillCheckSessionId.create(),
        liveCheck: SkillCheckId.create(),
        deadCheck: SkillCheckId.create(),
        ownSession: SkillCheckSessionId.create(),
        ownCheck: SkillCheckId.create(),
        foreignSession: SkillCheckSessionId.create(),
        foreignCheck: SkillCheckId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Test Org", slug: T.org, createdAt: new Date() },
        });
        for (const [id, name] of [
            [T.assessorA, "Assessor A"],
            [T.assessorB, "Assessor B"],
            [T.assessee, "Assessee"],
        ] as const) {
            await db.person.create({
                data: { id, organizationId: T.org, name, email: `${id}@example.com` },
            });
        }
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
                id: T.skill,
                skillPackageId: T.pkg,
                skillGroupId: T.grp,
                name: "Skill",
                description: "",
                properties: {},
            },
        });

        for (const [id, sessionNumber] of [
            [T.conflictSession, 1],
            [T.deletedSession, 2],
            [T.ownSession, 3],
            [T.foreignSession, 4],
        ] as const) {
            await db.skillCheckSession.create({
                data: {
                    id,
                    organizationId: T.org,
                    name: `Session ${sessionNumber}`,
                    sessionNumber,
                    startsAt: new Date(),
                    endsAt: new Date(),
                    notes: "",
                    assessors: { connect: [{ id: T.assessorA }, { id: T.assessorB }] },
                    assessees: { connect: [{ id: T.assessee }] },
                    skills: { connect: [{ id: T.skill }] },
                },
            });
        }

        const checks = [
            [T.checkA, T.conflictSession, T.assessorA, "Draft"],
            [T.checkB, T.conflictSession, T.assessorB, "Draft"],
            [T.liveCheck, T.deletedSession, T.assessorA, "Draft"],
            [T.deadCheck, T.deletedSession, T.assessorB, "Deleted"],
            [T.ownCheck, T.ownSession, T.assessorA, "Draft"],
            [T.foreignCheck, T.foreignSession, T.assessorB, "Draft"],
        ] as const;
        for (const [id, sessionId, assessorId, status] of checks) {
            await db.skillCheck.create({
                data: {
                    id,
                    organizationId: T.org,
                    sessionId,
                    assesseeId: T.assessee,
                    assessorId,
                    skillId: T.skill,
                    result: "Pass",
                    notes: "",
                    status,
                },
            });
        }
    });

    function makeCaller() {
        return skillCheckSessionsRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { organization: ["view"], skillCheckSession: ["approve"] },
                prisma: db,
            }),
        );
    }

    async function checkStatuses(sessionId: SkillCheckSessionId) {
        const rows = await db.skillCheck.findMany({ where: { sessionId } });
        return Object.fromEntries(rows.map(({ id, status }) => [id, status]));
    }

    it("rejects two included checks on one pair with BAD_REQUEST and writes nothing", async () => {
        await expect(
            makeCaller().approveSession({
                organizationId: T.org,
                sessionId: T.conflictSession,
                includedCheckIds: [T.checkA, T.checkB],
            }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });

        const session = await db.skillCheckSession.findUnique({
            where: { id: T.conflictSession },
        });
        expect(session?.status).toBe("Draft");
        expect(await checkStatuses(T.conflictSession)).toEqual({
            [T.checkA]: "Draft",
            [T.checkB]: "Draft",
        });
    });

    it("approves with one of the pair included, stamping Include and Exclude", async () => {
        const { updated } = await makeCaller().approveSession({
            organizationId: T.org,
            sessionId: T.conflictSession,
            includedCheckIds: [T.checkA],
        });

        expect(updated.status).toBe("Include");
        expect(await checkStatuses(T.conflictSession)).toEqual({
            [T.checkA]: "Include",
            [T.checkB]: "Exclude",
        });
    });

    it("doesn't count an included Deleted check towards a conflict", async () => {
        const { updated } = await makeCaller().approveSession({
            organizationId: T.org,
            sessionId: T.deletedSession,
            includedCheckIds: [T.liveCheck, T.deadCheck],
        });

        expect(updated.status).toBe("Include");
        expect(await checkStatuses(T.deletedSession)).toEqual({ [T.liveCheck]: "Include" });
    });

    it("doesn't count an id from another session towards a conflict", async () => {
        const { updated } = await makeCaller().approveSession({
            organizationId: T.org,
            sessionId: T.ownSession,
            includedCheckIds: [T.ownCheck, T.foreignCheck],
        });

        expect(updated.status).toBe("Include");
        expect(await checkStatuses(T.ownSession)).toEqual({ [T.ownCheck]: "Include" });
        expect(await checkStatuses(T.foreignSession)).toEqual({ [T.foreignCheck]: "Draft" });
    });
});
