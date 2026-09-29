/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import {
    assertSessionCheckTarget,
    createSession,
    listEligibleAssessors,
    nextSessionNumber,
    requireSessionAssessor,
    requireSessionById,
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
        //   skillsAdmin   → Active, linked, "skills-admin"               → excluded
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
