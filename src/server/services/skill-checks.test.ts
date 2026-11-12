/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheckId } from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { SkillPackageSubscriptionId } from "@/lib/schemas/skill-package-subscription";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import {
    assertAssessableSkills,
    assertSessionCheckTarget,
    assertSessionUnlocked,
    createSession,
    listEligibleAssessors,
    nextSessionNumber,
    requireSessionAssessor,
    requireSessionById,
    search,
} from "./skill-checks";

// The service reaches server-only modules at import time. The functions exercised here use an
// injected prisma client, so an empty stub is enough to let it import in jsdom.
vi.mock("server-only", () => ({}));

describe("skill-checks", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        session: SkillCheckSessionId.create(),
        outsiderSession: SkillCheckSessionId.create(),
        user: UserId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }

        await db.skillCheckSession.create({
            data: {
                id: T.session,
                organizationId: T.org,
                name: "Session One",
                sessionNumber: 1,
                startsAt: new Date("2026-01-01T00:00:00.000Z"),
                notes: "",
            },
        });
        await db.skillCheckSession.create({
            data: {
                id: T.outsiderSession,
                organizationId: T.otherOrg,
                name: "Outsider Session",
                sessionNumber: 1,
            },
        });
    });

    function ctx() {
        return createOrganizationMockContext({
            organizationId: T.org,
            user: { id: T.user },
            permissions: {},
            prisma: db,
        });
    }

    describe("requireSessionById", () => {
        it("returns the session when it exists in the organization", async () => {
            const session = await requireSessionById(ctx(), T.session);

            expect(session.id).toBe(T.session);
        });

        it("throws NotFoundError for a session that does not exist", async () => {
            await expect(requireSessionById(ctx(), SkillCheckSessionId.create())).rejects.toThrow(
                "not found",
            );
        });

        it("throws NotFoundError for a session belonging to another organization", async () => {
            await expect(requireSessionById(ctx(), T.outsiderSession)).rejects.toThrow(
                `SkillCheckSession(id=${T.outsiderSession}) not found.`,
            );
        });
    });

    describe("assertSessionUnlocked", () => {
        it("throws ConflictError for an approved session", () => {
            expect(() => assertSessionUnlocked({ id: T.session, status: "Include" })).toThrow(
                ConflictError,
            );
        });

        it("allows a Draft or Exclude session", () => {
            expect(() => assertSessionUnlocked({ id: T.session, status: "Draft" })).not.toThrow();
            expect(() => assertSessionUnlocked({ id: T.session, status: "Exclude" })).not.toThrow();
        });
    });

    describe("assertAssessableSkills", () => {
        // Dataset (all in B.org), one skill per package:
        //   available    → published, Active, subscribed    → assessable
        //   unpublished  → unpublished, Active, subscribed  → not assessable
        //   archived     → published, Archived, subscribed  → not assessable
        //   unsubscribed → published, Active, not subscribed → not assessable
        //   inDeletedGroup → published, Active, subscribed, but its group Deleted → not assessable
        //   inArchivedGroup → published, Active, subscribed, but its group Archived → not assessable
        //   archivedSkill → published, Active, subscribed, but the skill itself Archived → not assessable
        const B = {
            org: OrganizationId.create(),
            available: SkillId.create(),
            unpublished: SkillId.create(),
            archived: SkillId.create(),
            unsubscribed: SkillId.create(),
            inDeletedGroup: SkillId.create(),
            inArchivedGroup: SkillId.create(),
            archivedSkill: SkillId.create(),
        };

        beforeAll(async () => {
            await db.organization.create({
                data: { id: B.org, name: B.org, slug: B.org, createdAt: new Date() },
            });
            for (const [skillId, published, status, subscribed, groupStatus, skillStatus] of [
                [B.available, true, "Active", true, "Active", "Active"],
                [B.unpublished, false, "Active", true, "Active", "Active"],
                [B.archived, true, "Archived", true, "Active", "Active"],
                [B.unsubscribed, true, "Active", false, "Active", "Active"],
                [B.inDeletedGroup, true, "Active", true, "Deleted", "Active"],
                [B.inArchivedGroup, true, "Active", true, "Archived", "Active"],
                [B.archivedSkill, true, "Active", true, "Active", "Archived"],
            ] as const) {
                const skillPackageId = SkillPackageId.create();
                const skillGroupId = SkillGroupId.create();
                await db.skillPackage.create({
                    data: {
                        id: skillPackageId,
                        organizationId: B.org,
                        name: skillPackageId,
                        description: "",
                        properties: {},
                        published,
                        status,
                    },
                });
                await db.skillGroup.create({
                    data: {
                        id: skillGroupId,
                        skillPackageId,
                        name: skillGroupId,
                        description: "",
                        properties: {},
                        status: groupStatus,
                    },
                });
                await db.skill.create({
                    data: {
                        id: skillId,
                        skillPackageId,
                        skillGroupId,
                        name: skillId,
                        description: "",
                        properties: {},
                        status: skillStatus,
                    },
                });
                if (subscribed) {
                    await db.skillPackageSubscription.create({
                        data: {
                            id: SkillPackageSubscriptionId.create(),
                            organizationId: B.org,
                            skillPackageId,
                        },
                    });
                }
            }
        });

        function ctxB() {
            return createOrganizationMockContext({
                organizationId: B.org,
                user: { id: T.user },
                permissions: {},
                prisma: db,
            });
        }

        it("accepts a skill from an available subscribed package", async () => {
            await expect(assertAssessableSkills(ctxB(), [B.available])).resolves.toBeUndefined();
        });

        it.each([
            ["an unpublished", B.unpublished],
            ["an Archived", B.archived],
            ["an unsubscribed", B.unsubscribed],
        ])("rejects a skill from %s package, naming only that skill", async (_, skillId) => {
            const error = await assertAssessableSkills(ctxB(), [B.available, skillId]).catch(
                (e: unknown) => e,
            );
            expect(error).toBeInstanceOf(ValidationError);
            expect((error as Error).message).toContain(`Skill(id=${skillId})`);
            expect((error as Error).message).not.toContain(B.available);
        });

        it.each([
            ["an Active skill whose group is Deleted", B.inDeletedGroup],
            ["an Active skill whose group is Archived", B.inArchivedGroup],
            ["an Archived skill", B.archivedSkill],
        ])("rejects %s", async (_, skillId) => {
            await expect(assertAssessableSkills(ctxB(), [skillId])).rejects.toThrow(
                ValidationError,
            );
        });
    });

    describe("requireSessionAssessor + assertSessionCheckTarget", () => {
        // Dataset (all in A.org — its own org, so the suites below keep their session numbers):
        //   assessorUser → linked to assessor, who is assigned to assessedSession
        //   otherUser    → linked to other, NOT assigned
        //   T.user       → no OrganizationUser at all (unlinked)
        //   assessedSession → assessees [assessee], skills [skill], assessors [assessor]
        const A = {
            org: OrganizationId.create(),
            assessorUser: UserId.create(),
            otherUser: UserId.create(),
            assessor: PersonId.create(),
            other: PersonId.create(),
            assessee: PersonId.create(),
            pkg: SkillPackageId.create(),
            grp: SkillGroupId.create(),
            skill: SkillId.create(),
            assessedSession: SkillCheckSessionId.create(),
        };

        beforeAll(async () => {
            await db.organization.create({
                data: { id: A.org, name: A.org, slug: A.org, createdAt: new Date() },
            });
            for (const id of [A.assessor, A.other, A.assessee]) {
                await db.person.create({
                    data: { id, organizationId: A.org, name: id, email: `${id}@example.com` },
                });
            }
            for (const [userId, personId] of [
                [A.assessorUser, A.assessor],
                [A.otherUser, A.other],
            ] as const) {
                await db.organizationUser.create({
                    data: {
                        id: nanoId16(),
                        organizationId: A.org,
                        userId,
                        role: "member",
                        personId,
                    },
                });
            }
            await db.skillPackage.create({
                data: {
                    id: A.pkg,
                    organizationId: A.org,
                    name: "Pkg",
                    description: "",
                    properties: {},
                    published: true,
                },
            });
            await db.skillGroup.create({
                data: {
                    id: A.grp,
                    skillPackageId: A.pkg,
                    name: "Group",
                    description: "",
                    properties: {},
                },
            });
            await db.skill.create({
                data: {
                    id: A.skill,
                    skillPackageId: A.pkg,
                    skillGroupId: A.grp,
                    name: "Skill",
                    description: "",
                    properties: {},
                },
            });
            await db.skillCheckSession.create({
                data: {
                    id: A.assessedSession,
                    organizationId: A.org,
                    name: "Assessed Session",
                    sessionNumber: 1,
                    startsAt: new Date("2026-01-01T00:00:00.000Z"),
                    notes: "",
                    assessors: { connect: [{ id: A.assessor }] },
                    assessees: { connect: [{ id: A.assessee }] },
                    skills: { connect: [{ id: A.skill }] },
                },
            });
        });

        function ctxFor(userId: UserId) {
            return createOrganizationMockContext({
                organizationId: A.org,
                user: { id: userId },
                permissions: {},
                prisma: db,
            });
        }

        it("returns the session's members and the caller's person as the assessor", async () => {
            const { session, assessorId } = await requireSessionAssessor(
                ctxFor(A.assessorUser),
                A.assessedSession,
            );

            expect(assessorId).toBe(A.assessor);
            expect(session.id).toBe(A.assessedSession);
            expect(session.assesseeIds).toEqual([A.assessee]);
            expect(session.skillIds).toEqual([A.skill]);
        });

        it("throws NotFoundError for a session in another organization", async () => {
            await expect(
                requireSessionAssessor(ctxFor(A.assessorUser), T.outsiderSession),
            ).rejects.toBeInstanceOf(NotFoundError);
        });

        it("throws ValidationError when the caller has no linked person", async () => {
            await expect(
                requireSessionAssessor(ctxFor(T.user), A.assessedSession),
            ).rejects.toBeInstanceOf(ValidationError);
        });

        it("throws ForbiddenError when the caller is not an assigned assessor", async () => {
            await expect(
                requireSessionAssessor(ctxFor(A.otherUser), A.assessedSession),
            ).rejects.toBeInstanceOf(ForbiddenError);
        });

        it("accepts a target on the session and rejects an assessee or skill off it", async () => {
            const { session } = await requireSessionAssessor(
                ctxFor(A.assessorUser),
                A.assessedSession,
            );

            expect(() =>
                assertSessionCheckTarget(session, { assesseeId: A.assessee, skillId: A.skill }),
            ).not.toThrow();
            expect(() =>
                assertSessionCheckTarget(session, { assesseeId: A.other, skillId: A.skill }),
            ).toThrow(ValidationError);
            expect(() =>
                assertSessionCheckTarget(session, {
                    assesseeId: A.assessee,
                    skillId: SkillId.create(),
                }),
            ).toThrow(ValidationError);
        });
    });

    describe("listEligibleAssessors", () => {
        // Dataset (all in T.org unless noted):
        //   assessor      → Active, linked, "skills-assessor"            → eligible
        //   multiRole     → Active, linked, "member,skills-assessor"     → eligible
        //   unlinked      → Active, no OrganizationUser                  → excluded
        //   memberOnly    → Active, linked, "member"                     → excluded
        //   skillsAdmin   → Active, linked, "skills-admin"               → eligible
        //   archived      → Archived, linked, "skills-assessor"          → excluded
        //   outsider      → in T.otherOrg, linked, "skills-assessor"     → excluded
        const P = {
            assessor: PersonId.create(),
            multiRole: PersonId.create(),
            unlinked: PersonId.create(),
            memberOnly: PersonId.create(),
            skillsAdmin: PersonId.create(),
            archived: PersonId.create(),
            outsider: PersonId.create(),
        };

        beforeAll(async () => {
            const people: {
                id: PersonId;
                name: string;
                organizationId?: OrganizationId;
                status?: "Active" | "Archived";
                role?: string;
            }[] = [
                { id: P.assessor, name: "Zed Assessor", role: "skills-assessor" },
                { id: P.multiRole, name: "Amy MultiRole", role: "member,skills-assessor" },
                { id: P.unlinked, name: "Unlinked" },
                { id: P.memberOnly, name: "Member Only", role: "member" },
                { id: P.skillsAdmin, name: "Skills Admin", role: "skills-admin" },
                {
                    id: P.archived,
                    name: "Archived",
                    status: "Archived",
                    role: "skills-assessor",
                },
                {
                    id: P.outsider,
                    name: "Outsider",
                    organizationId: T.otherOrg,
                    role: "skills-assessor",
                },
            ];

            for (const { id, name, organizationId = T.org, status = "Active", role } of people) {
                await db.person.create({
                    data: { id, organizationId, name, email: `${id}@example.com`, status },
                });
                if (role) {
                    await db.organizationUser.create({
                        data: {
                            id: nanoId16(),
                            organizationId,
                            userId: UserId.create(),
                            role,
                            personId: id,
                        },
                    });
                }
            }
        });

        it("returns only active, linked people whose role can record checks, sorted by name", async () => {
            expect(await listEligibleAssessors(ctx())).toEqual([
                { id: P.multiRole, name: "Amy MultiRole" },
                { id: P.skillsAdmin, name: "Skills Admin" },
                { id: P.assessor, name: "Zed Assessor" },
            ]);
        });
    });

    describe("nextSessionNumber", () => {
        it("is one greater than the highest existing sessionNumber", async () => {
            expect(await nextSessionNumber(ctx())).toBe(2);
        });

        it("does not count another organization's sessions", async () => {
            const emptyOrg = OrganizationId.create();
            await db.organization.create({
                data: { id: emptyOrg, name: emptyOrg, slug: emptyOrg, createdAt: new Date() },
            });

            expect(
                await nextSessionNumber(
                    createOrganizationMockContext({
                        organizationId: emptyOrg,
                        user: { id: T.user },
                        permissions: {},
                        prisma: db,
                    }),
                ),
            ).toBe(1);
        });
    });

    describe("createSession", () => {
        it("assigns the next available session number", async () => {
            const created = await createSession(ctx(), (sessionNumber) => ({
                id: SkillCheckSessionId.create(),
                organizationId: T.org,
                name: "New Session",
                sessionNumber,
            }));

            expect(created.sessionNumber).toBe(2);
        });

        it("retries with the next number on a sessionNumber collision", async () => {
            // A concurrent create already took the number `nextSessionNumber` would report next
            // (3, since "New Session" above claimed 2) — createSession must recover from the
            // unique-constraint violation rather than surfacing it.
            await db.skillCheckSession.create({
                data: {
                    id: SkillCheckSessionId.create(),
                    organizationId: T.org,
                    name: "Raced In First",
                    sessionNumber: 3,
                },
            });

            const created = await createSession(ctx(), (sessionNumber) => ({
                id: SkillCheckSessionId.create(),
                organizationId: T.org,
                name: "Retried Session",
                sessionNumber,
            }));

            expect(created.sessionNumber).toBe(4);
        });
    });
});

describe("skill-checks search", () => {
    // Dataset (in S.org unless noted), checkedAt in UTC; NZ is +13 until 2026-04-05 03:00, +12
    // after, so NZ's 2026-04-05 is 25 hours long:
    //   early      alice / skill1 / dana, session,    Fail, 2026-03-10 00:00
    //   standalone bob   / skill2 / eve,  no session, Fail, 2026-03-12 00:00
    //   lateTo     alice / skill2 / dana, no session, Pass, 2026-03-15 10:30 (NZ 15th 23:30)
    //   nextDay    bob   / skill1 / eve,  session,    Pass, 2026-03-15 11:30 (NZ 16th 00:30)
    //   dstLate    alice / skill1 / eve,  session,    Pass, 2026-04-05 11:30 (NZ 5th 23:30)
    //   dstNext    bob   / skill2 / dana, session,    Pass, 2026-04-05 12:30 (NZ 6th 00:30)
    //   tieA       alice / skill1 / dana, no session, Pass, 2026-05-01 00:00
    //   tieB       alice / skill1 / eve,  no session, Pass, 2026-05-01 00:00
    //   deleted    bob   / skill1 / dana, session,    Pass, Deleted, 2026-05-02
    //   outsider   (otherOrg) alice / skill1, 2026-05-03
    const S = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: UserId.create(),
        alice: PersonId.create(),
        bob: PersonId.create(),
        dana: PersonId.create(),
        eve: PersonId.create(),
        pkg: SkillPackageId.create(),
        grp: SkillGroupId.create(),
        skill1: SkillId.create(),
        skill2: SkillId.create(),
        session: SkillCheckSessionId.create(),
        early: SkillCheckId.create(),
        standalone: SkillCheckId.create(),
        lateTo: SkillCheckId.create(),
        nextDay: SkillCheckId.create(),
        dstLate: SkillCheckId.create(),
        dstNext: SkillCheckId.create(),
        tieA: SkillCheckId.create(),
        tieB: SkillCheckId.create(),
        deleted: SkillCheckId.create(),
        outsider: SkillCheckId.create(),
    };
    const NZ = "Pacific/Auckland";
    const [tieHigh, tieLow] = [S.tieA, S.tieB].sort().reverse();

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [S.org, S.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }
        for (const [id, name] of [
            [S.alice, "Alice"],
            [S.bob, "Bob"],
            [S.dana, "Dana"],
            [S.eve, "Eve"],
        ] as const) {
            await db.person.create({
                data: { id, organizationId: S.org, name, email: `${id}@example.com` },
            });
        }
        await db.skillPackage.create({
            data: {
                id: S.pkg,
                organizationId: S.org,
                name: "Pkg",
                description: "",
                properties: {},
                published: true,
            },
        });
        await db.skillGroup.create({
            data: {
                id: S.grp,
                skillPackageId: S.pkg,
                name: "Group",
                description: "",
                properties: {},
            },
        });
        for (const [id, name] of [
            [S.skill1, "Skill 1"],
            [S.skill2, "Skill 2"],
        ] as const) {
            await db.skill.create({
                data: {
                    id,
                    skillPackageId: S.pkg,
                    skillGroupId: S.grp,
                    name,
                    description: "",
                    properties: {},
                },
            });
        }
        await db.skillCheckSession.create({
            data: {
                id: S.session,
                organizationId: S.org,
                name: "Session",
                sessionNumber: 1,
                notes: "",
            },
        });

        type Row = {
            id: SkillCheckId;
            organizationId?: OrganizationId;
            assesseeId: PersonId;
            skillId: SkillId;
            assessorId: PersonId;
            sessionId: SkillCheckSessionId | null;
            result: "Pass" | "Fail";
            status?: "Draft" | "Include" | "Deleted";
            checkedAt: string;
        };
        const checks: Row[] = [
            {
                id: S.early,
                assesseeId: S.alice,
                skillId: S.skill1,
                assessorId: S.dana,
                sessionId: S.session,
                result: "Fail",
                checkedAt: "2026-03-10T00:00:00Z",
            },
            {
                id: S.standalone,
                assesseeId: S.bob,
                skillId: S.skill2,
                assessorId: S.eve,
                sessionId: null,
                result: "Fail",
                checkedAt: "2026-03-12T00:00:00Z",
            },
            {
                id: S.lateTo,
                assesseeId: S.alice,
                skillId: S.skill2,
                assessorId: S.dana,
                sessionId: null,
                result: "Pass",
                checkedAt: "2026-03-15T10:30:00Z",
            },
            {
                id: S.nextDay,
                assesseeId: S.bob,
                skillId: S.skill1,
                assessorId: S.eve,
                sessionId: S.session,
                result: "Pass",
                checkedAt: "2026-03-15T11:30:00Z",
            },
            {
                id: S.dstLate,
                assesseeId: S.alice,
                skillId: S.skill1,
                assessorId: S.eve,
                sessionId: S.session,
                result: "Pass",
                checkedAt: "2026-04-05T11:30:00Z",
            },
            {
                id: S.dstNext,
                assesseeId: S.bob,
                skillId: S.skill2,
                assessorId: S.dana,
                sessionId: S.session,
                result: "Pass",
                checkedAt: "2026-04-05T12:30:00Z",
            },
            ...(
                [
                    [S.tieA, S.dana],
                    [S.tieB, S.eve],
                ] as const
            ).map(
                ([id, assessorId]): Row => ({
                    id,
                    assesseeId: S.alice,
                    skillId: S.skill1,
                    assessorId,
                    sessionId: null,
                    result: "Pass",
                    checkedAt: "2026-05-01T00:00:00Z",
                }),
            ),
            {
                id: S.deleted,
                assesseeId: S.bob,
                skillId: S.skill1,
                assessorId: S.dana,
                sessionId: S.session,
                result: "Pass",
                status: "Deleted",
                checkedAt: "2026-05-02T00:00:00Z",
            },
            {
                id: S.outsider,
                organizationId: S.otherOrg,
                assesseeId: S.alice,
                skillId: S.skill1,
                assessorId: S.dana,
                sessionId: null,
                result: "Pass",
                checkedAt: "2026-05-03T00:00:00Z",
            },
        ];
        for (const { organizationId = S.org, status = "Include", checkedAt, ...rest } of checks) {
            await db.skillCheck.create({
                data: {
                    ...rest,
                    organizationId,
                    status,
                    notes: "",
                    checkedAt: new Date(checkedAt),
                },
            });
        }
    });

    function ctx() {
        return createOrganizationMockContext({
            organizationId: S.org,
            user: { id: S.user },
            permissions: {},
            prisma: db,
        });
    }

    async function ids(
        filters: Parameters<typeof search>[1]["filters"],
        { timeZone = NZ, page = 1, pageSize = 100 } = {},
    ) {
        const { rows } = await search(ctx(), { filters, page, pageSize, timeZone });
        return rows.map((row) => row.id);
    }

    it("returns every non-Deleted check in the organization, newest first, ties by id", async () => {
        expect(await ids({})).toEqual([
            tieHigh,
            tieLow,
            S.dstNext,
            S.dstLate,
            S.nextDay,
            S.lateTo,
            S.standalone,
            S.early,
        ]);
    });

    it("never returns a Deleted check or another organization's check", async () => {
        const all = await ids({});

        expect(all).not.toContain(S.deleted);
        expect(all).not.toContain(S.outsider);
    });

    it("resolves names for assessee, assessor, skill and session", async () => {
        const { rows } = await search(ctx(), {
            filters: { assesseeId: S.bob, skillId: S.skill1 },
            page: 1,
            pageSize: 10,
            timeZone: NZ,
        });

        expect(rows).toEqual([
            expect.objectContaining({
                id: S.nextDay,
                assessee: { id: S.bob, name: "Bob" },
                assessor: { id: S.eve, name: "Eve" },
                skill: { id: S.skill1, name: "Skill 1" },
                session: { id: S.session, name: "Session" },
            }),
        ]);
    });

    it("filters by assessee", async () => {
        expect(await ids({ assesseeId: S.bob })).toEqual([S.dstNext, S.nextDay, S.standalone]);
    });

    it("filters by assessor", async () => {
        expect(await ids({ assessorId: S.eve })).toEqual([
            S.tieB,
            S.dstLate,
            S.nextDay,
            S.standalone,
        ]);
    });

    it("filters by skill", async () => {
        expect(await ids({ skillId: S.skill2 })).toEqual([S.dstNext, S.lateTo, S.standalone]);
    });

    it("filters by session", async () => {
        expect(await ids({ sessionId: S.session })).toEqual([
            S.dstNext,
            S.dstLate,
            S.nextDay,
            S.early,
        ]);
    });

    it('returns only standalone checks for session "none"', async () => {
        expect(await ids({ sessionId: "none" })).toEqual([tieHigh, tieLow, S.lateTo, S.standalone]);
    });

    it("filters by result", async () => {
        expect(await ids({ result: "Fail" })).toEqual([S.standalone, S.early]);
    });

    it("combines filters", async () => {
        expect(await ids({ assesseeId: S.alice, skillId: S.skill2 })).toEqual([S.lateTo]);
    });

    it("includes both ends of the date range", async () => {
        expect(await ids({ from: "2026-03-10", to: "2026-03-12" })).toEqual([
            S.standalone,
            S.early,
        ]);
    });

    it("includes a check late on the to day in the viewer's zone, not one just after it", async () => {
        expect(await ids({ from: "2026-03-15", to: "2026-03-15" })).toEqual([S.lateTo]);
        expect(await ids({ from: "2026-03-16", to: "2026-03-16" })).toEqual([S.nextDay]);
    });

    it("judges the days in the given time zone", async () => {
        // In UTC both checks fall on the 15th.
        expect(await ids({ from: "2026-03-15", to: "2026-03-15" }, { timeZone: "UTC" })).toEqual([
            S.nextDay,
            S.lateTo,
        ]);
    });

    it("bounds the to day by its real length across a DST change", async () => {
        // NZ's 2026-04-05 is 25 hours long; a fixed 24 hours from its start would miss dstLate.
        expect(await ids({ from: "2026-04-05", to: "2026-04-05" })).toEqual([S.dstLate]);
        expect(await ids({ from: "2026-04-06" })).toEqual([tieHigh, tieLow, S.dstNext]);
    });

    it("slices pages and reports the total across them", async () => {
        const page2 = await search(ctx(), { filters: {}, page: 2, pageSize: 3, timeZone: NZ });

        expect(page2.total).toBe(8);
        expect(page2.rows.map((row) => row.id)).toEqual([S.dstLate, S.nextDay, S.lateTo]);
    });

    it("counts the filtered total, not the organization's", async () => {
        const result = await search(ctx(), {
            filters: { assesseeId: S.bob },
            page: 1,
            pageSize: 1,
            timeZone: NZ,
        });

        expect(result.total).toBe(3);
        expect(result.rows.map((row) => row.id)).toEqual([S.dstNext]);
    });

    it("returns no rows and the real total for a page past the end", async () => {
        const result = await search(ctx(), { filters: {}, page: 5, pageSize: 3, timeZone: NZ });

        expect(result).toEqual({ rows: [], total: 8 });
    });
});
