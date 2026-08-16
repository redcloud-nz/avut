/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

import { createMockPrisma } from "@/test/create-prisma-mock";
import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillId } from "@/lib/schemas/skill";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { TeamId } from "@/lib/schemas/team";
import { UserId } from "@/lib/schemas/user";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { skillChecksRouter } from "./skill-checks-router";

describe("skillChecks.getCompetencyMatrix", () => {
    // Dataset layout:
    //   People:  person1 Alice (Active, team1)
    //            person2 Bob   (Active, team1 + team2)
    //            person3 Charlie (Archived, team1)
    //   Teams:   team1 = [person1, person2, person3], team2 = [person2]
    //   Pkgs:    pkg1 "First Aid" (published) → grp1 "Basic Skills" → skill1 CPR freq=12 (Active)
    //                                                               → skill2 Bandaging freq=6 (Active)
    //                                                               → skill5 Deprecated (Archived)
    //                                        → grp2 "Advanced Skills" → skill3 Airway freq=12 (Active)
    //            pkg2 "Advanced" (not published) → grp3 → skill4 (Active but unreachable)
    //   Checks (fake now = 2026-01-01 for isCurrent tests):
    //     person1+skill1+assessor1: Include 2025-01-01 "Fail" (old, expired → de-duped away)
    //     person1+skill1+assessor2: Include 2025-06-01 "Pass"       (newer, current → kept)
    //     person1+skill2+assessor1: Include 2025-10-15 "Pass"       (freq=6, expires 2026-04-15)
    //     person2+skill1+assessor1: Include 2024-12-01 "Pass"       (13 months ago → expired)
    //     person2+skill2+assessor1: Draft  2025-06-01  "StrongPass" (excluded by status filter)

    const T = {
        org: OrganizationId.create(),
        user: nanoId16(),
        person1: PersonId.create(),
        person2: PersonId.create(),
        person3: PersonId.create(),
        assessor1: PersonId.create(),
        assessor2: PersonId.create(),
        team1: TeamId.create(),
        team2: TeamId.create(),
        pkg1: SkillPackageId.create(),
        pkg2: SkillPackageId.create(),
        grp1: SkillGroupId.create(),
        grp2: SkillGroupId.create(),
        grp3: SkillGroupId.create(),
        skill1: SkillId.create(),
        skill2: SkillId.create(),
        skill3: SkillId.create(),
        skill4: SkillId.create(),
        skill5: SkillId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        await db.organization.create({
            data: { id: T.org, name: "Test Org", slug: T.org, createdAt: new Date() },
        });

        // People
        await db.person.create({
            data: {
                id: T.person1,
                organizationId: T.org,
                name: "Alice",
                email: `${T.person1}@example.com`,
            },
        });
        await db.person.create({
            data: {
                id: T.person2,
                organizationId: T.org,
                name: "Bob",
                email: `${T.person2}@example.com`,
            },
        });
        await db.person.create({
            data: {
                id: T.person3,
                organizationId: T.org,
                name: "Charlie",
                email: `${T.person3}@example.com`,
                status: "Archived" as never,
            },
        });
        await db.person.create({
            data: {
                id: T.assessor1,
                organizationId: T.org,
                name: "Assessor 1",
                email: `${T.assessor1}@example.com`,
            },
        });
        await db.person.create({
            data: {
                id: T.assessor2,
                organizationId: T.org,
                name: "Assessor 2",
                email: `${T.assessor2}@example.com`,
            },
        });

        // Teams
        await db.team.create({ data: { id: T.team1, organizationId: T.org, name: "Team A" } });
        await db.team.create({ data: { id: T.team2, organizationId: T.org, name: "Team B" } });
        await db.teamMembership.create({
            data: { id: nanoId16(), organizationId: T.org, teamId: T.team1, personId: T.person1 },
        });
        await db.teamMembership.create({
            data: { id: nanoId16(), organizationId: T.org, teamId: T.team1, personId: T.person2 },
        });
        await db.teamMembership.create({
            data: { id: nanoId16(), organizationId: T.org, teamId: T.team1, personId: T.person3 },
        }); // archived
        await db.teamMembership.create({
            data: { id: nanoId16(), organizationId: T.org, teamId: T.team2, personId: T.person2 },
        });

        // Skill packages
        await db.skillPackage.create({
            data: {
                id: T.pkg1,
                organizationId: T.org,
                name: "First Aid",
                description: "",
                properties: {},
                published: true,
            },
        });
        await db.skillPackage.create({
            data: {
                id: T.pkg2,
                organizationId: T.org,
                name: "Advanced",
                description: "",
                properties: {},
                published: false,
            },
        });

        // Skill groups
        await db.skillGroup.create({
            data: {
                id: T.grp1,
                skillPackageId: T.pkg1,
                name: "Basic Skills",
                description: "",
                properties: {},
            },
        });
        await db.skillGroup.create({
            data: {
                id: T.grp2,
                skillPackageId: T.pkg1,
                name: "Advanced Skills",
                description: "",
                properties: {},
            },
        });
        await db.skillGroup.create({
            data: {
                id: T.grp3,
                skillPackageId: T.pkg2,
                name: "Special",
                description: "",
                properties: {},
            },
        });

        // Skills
        await db.skill.create({
            data: {
                id: T.skill1,
                skillPackageId: T.pkg1,
                skillGroupId: T.grp1,
                name: "CPR",
                description: "",
                properties: {},
                frequency: 12,
            },
        });
        await db.skill.create({
            data: {
                id: T.skill2,
                skillPackageId: T.pkg1,
                skillGroupId: T.grp1,
                name: "Bandaging",
                description: "",
                properties: {},
                frequency: 6,
            },
        });
        await db.skill.create({
            data: {
                id: T.skill3,
                skillPackageId: T.pkg1,
                skillGroupId: T.grp2,
                name: "Airway",
                description: "",
                properties: {},
                frequency: 12,
            },
        });
        await db.skill.create({
            data: {
                id: T.skill4,
                skillPackageId: T.pkg2,
                skillGroupId: T.grp3,
                name: "Defibrillation",
                description: "",
                properties: {},
            },
        });
        await db.skill.create({
            data: {
                id: T.skill5,
                skillPackageId: T.pkg1,
                skillGroupId: T.grp1,
                name: "Deprecated",
                description: "",
                properties: {},
                status: "Archived" as never,
            },
        });

        // Subscriptions (both packages)
        await db.skillPackageSubscription.create({
            data: { id: nanoId16(), organizationId: T.org, skillPackageId: T.pkg1 },
        });
        await db.skillPackageSubscription.create({
            data: { id: nanoId16(), organizationId: T.org, skillPackageId: T.pkg2 },
        });

        // Skill checks — two assessors let us create two Include checks for the same (assessee, skill)
        // without hitting the @@unique(assesseeId, assessorId, sessionId, skillId) constraint.
        await db.skillCheck.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                assesseeId: T.person1,
                assessorId: T.assessor1,
                skillId: T.skill1,
                result: "Fail",
                notes: "",
                status: "Include",
                createdAt: new Date("2025-01-01"),
            },
        });
        await db.skillCheck.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                assesseeId: T.person1,
                assessorId: T.assessor2,
                skillId: T.skill1,
                result: "Pass",
                notes: "",
                status: "Include",
                createdAt: new Date("2025-06-01"),
            },
        });
        await db.skillCheck.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                assesseeId: T.person1,
                assessorId: T.assessor1,
                skillId: T.skill2,
                result: "Pass",
                notes: "",
                status: "Include",
                createdAt: new Date("2025-10-15"),
            },
        });
        await db.skillCheck.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                assesseeId: T.person2,
                assessorId: T.assessor1,
                skillId: T.skill1,
                result: "Pass",
                notes: "",
                status: "Include",
                createdAt: new Date("2024-12-01"),
            },
        });
        await db.skillCheck.create({
            data: {
                id: nanoId16(),
                organizationId: T.org,
                assesseeId: T.person2,
                assessorId: T.assessor1,
                skillId: T.skill2,
                result: "StrongPass",
                notes: "",
                status: "Draft",
                createdAt: new Date("2025-06-01"),
            },
        });
    });

    function makeCaller() {
        return skillChecksRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: T.user },
                permissions: { skillCheck: ["view"], organization: ["view"] },
                prisma: db,
            }),
        );
    }

    describe("personnel scope", () => {
        it("returns only active members of the given team", async () => {
            // team1 contains person1, person2 (Active) and person3 (Archived)
            const result = await makeCaller().getCompetencyMatrix({
                organizationId: T.org,
                teamId: T.team1,
            });

            const ids = result.personnel.map((p) => p.id);
            expect(ids).toContain(T.person1);
            expect(ids).toContain(T.person2);
            expect(ids).not.toContain(T.person3);
            expect(result.personnel).toHaveLength(2);
        });

        it("returns only members of the specified team, not other org personnel", async () => {
            // team2 has only person2
            const result = await makeCaller().getCompetencyMatrix({
                organizationId: T.org,
                teamId: T.team2,
            });

            expect(result.personnel).toHaveLength(1);
            expect(result.personnel[0].id).toBe(T.person2);
        });

        it("returns the person by id when personId is provided", async () => {
            const result = await makeCaller().getCompetencyMatrix({
                organizationId: T.org,
                personId: T.person1,
            });

            expect(result.personnel).toEqual([{ id: T.person1, name: "Alice" }]);
        });

        it("returns empty personnel when the person is not active", async () => {
            // person3 exists in the org but is Archived
            const result = await makeCaller().getCompetencyMatrix({
                organizationId: T.org,
                personId: T.person3,
            });

            expect(result.personnel).toHaveLength(0);
        });

        it("returns all active org personnel when no scope is provided", async () => {
            const result = await makeCaller().getCompetencyMatrix({ organizationId: T.org });

            const ids = result.personnel.map((p) => p.id);
            expect(ids).toContain(T.person1);
            expect(ids).toContain(T.person2);
            expect(ids).not.toContain(T.person3); // Archived
        });
    });

    describe("skill scope", () => {
        it("returns active skills from all subscribed packages", async () => {
            const result = await makeCaller().getCompetencyMatrix({ organizationId: T.org });

            const ids = result.skills.map((s) => s.id);
            expect(ids).toContain(T.skill1);
            expect(ids).toContain(T.skill2);
            expect(ids).toContain(T.skill3);
            expect(ids).not.toContain(T.skill4); // pkg2 not published
            expect(ids).not.toContain(T.skill5); // Archived
        });

        it("filters to a single skill when skillId is provided", async () => {
            const result = await makeCaller().getCompetencyMatrix({
                organizationId: T.org,
                skillId: T.skill1,
            });

            expect(result.skills).toHaveLength(1);
            expect(result.skills[0].id).toBe(T.skill1);
        });

        it("filters skills by skillGroupId", async () => {
            // grp1 has skill1, skill2 (Active) and skill5 (Archived — excluded)
            const result = await makeCaller().getCompetencyMatrix({
                organizationId: T.org,
                skillGroupId: T.grp1,
            });

            const ids = result.skills.map((s) => s.id);
            expect(ids).toContain(T.skill1);
            expect(ids).toContain(T.skill2);
            expect(ids).not.toContain(T.skill5);
            expect(result.skills).toHaveLength(2);
        });

        it("filters skills by skillPackageId", async () => {
            // pkg1 has skill1, skill2, skill3 (Active) and skill5 (Archived — excluded)
            const result = await makeCaller().getCompetencyMatrix({
                organizationId: T.org,
                skillPackageId: T.pkg1,
            });

            const ids = result.skills.map((s) => s.id);
            expect(ids).toContain(T.skill1);
            expect(ids).toContain(T.skill2);
            expect(ids).toContain(T.skill3);
            expect(ids).not.toContain(T.skill5);
            expect(result.skills).toHaveLength(3);
        });

        it("returns each skill with its group and package ids", async () => {
            const result = await makeCaller().getCompetencyMatrix({
                organizationId: T.org,
                skillId: T.skill1,
            });

            expect(result.skills[0]).toMatchObject({
                id: T.skill1,
                name: "CPR",
                skillGroupId: T.grp1,
                skillPackageId: T.pkg1,
            });
        });

        it("returns only the groups and packages containing an in-scope skill", async () => {
            // skill1 lives in grp1/pkg1; grp2 and pkg2 must not come along for the ride.
            const result = await makeCaller().getCompetencyMatrix({
                organizationId: T.org,
                skillId: T.skill1,
            });

            expect(result.skillGroups.map((g) => g.id)).toEqual([T.grp1]);
            expect(result.skillPackages.map((p) => p.id)).toEqual([T.pkg1]);
        });

        it("returns every group of a subscribed package that has active skills", async () => {
            // pkg1 has grp1 (skill1, skill2) and grp2 (skill3); pkg2 is not published.
            const result = await makeCaller().getCompetencyMatrix({ organizationId: T.org });

            expect(result.skillGroups.map((g) => g.id).sort()).toEqual([T.grp1, T.grp2].sort());
            expect(result.skillPackages.map((p) => p.id)).toEqual([T.pkg1]);
        });
    });

    describe("competencies", () => {
        it("returns empty competencies when no check exists for the given scope", async () => {
            // person1 has no check for skill3
            const result = await makeCaller().getCompetencyMatrix({
                organizationId: T.org,
                personId: T.person1,
                skillId: T.skill3,
            });

            expect(result.competencies).toHaveLength(0);
        });

        it("only includes Include-status checks", async () => {
            // person2 has an Include check for skill1 and a Draft check for skill2
            const result = await makeCaller().getCompetencyMatrix({
                organizationId: T.org,
                personId: T.person2,
            });

            const skillIds = result.competencies.map((c) => c.skillId);
            expect(skillIds).toContain(T.skill1);
            expect(skillIds).not.toContain(T.skill2); // only Draft check
        });

        it("de-duplicates checks, keeping the most recent Include per (assessee, skill)", async () => {
            // person1+skill1 has two Include checks; the newer one (2025-06-01) should win
            const result = await makeCaller().getCompetencyMatrix({
                organizationId: T.org,
                personId: T.person1,
                skillId: T.skill1,
            });

            expect(result.competencies).toHaveLength(1);
            expect(result.competencies[0].result).toBe("Pass");
        });

        it("returns a separate entry for each (assessee, skill) pair", async () => {
            // Active personnel × active skills with Include checks:
            //   person1+skill1, person1+skill2, person2+skill1  (person2+skill2 is Draft → excluded)
            const result = await makeCaller().getCompetencyMatrix({ organizationId: T.org });

            expect(result.competencies).toHaveLength(3);
        });
    });

    describe("isCurrent and expiresAt", () => {
        beforeEach(() => {
            vi.useFakeTimers({ now: new Date("2026-01-01T00:00:00.000Z") });
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("marks check as current when within the frequency window", async () => {
            // person1+skill1 newest check: 2025-06-01, freq=12 → expires 2026-06-01 > now
            const result = await makeCaller().getCompetencyMatrix({
                organizationId: T.org,
                personId: T.person1,
                skillId: T.skill1,
            });

            expect(result.competencies[0].isCurrent).toBe(true);
        });

        it("marks check as expired when past the frequency window", async () => {
            // person2+skill1: 2024-12-01, freq=12 → expires 2025-12-01 < now
            const result = await makeCaller().getCompetencyMatrix({
                organizationId: T.org,
                personId: T.person2,
                skillId: T.skill1,
            });

            expect(result.competencies[0].isCurrent).toBe(false);
        });

        it("computes expiresAt as checkedAt plus frequency months", async () => {
            // person1+skill2: checked 2025-10-15, freq=6 → expires 2026-04-15
            const result = await makeCaller().getCompetencyMatrix({
                organizationId: T.org,
                personId: T.person1,
                skillId: T.skill2,
            });

            const expected = new Date("2025-10-15T00:00:00.000Z");
            expected.setMonth(expected.getMonth() + 6);
            expect(result.competencies[0].expiresAt).toBe(expected.toISOString());
        });
    });

    describe("input validation", () => {
        it("rejects input with both teamId and personId", async () => {
            await expect(
                makeCaller().getCompetencyMatrix({
                    organizationId: T.org,
                    teamId: T.team1,
                    personId: T.person1,
                }),
            ).rejects.toThrow(TRPCError);
        });

        it("rejects input with both skillId and skillGroupId", async () => {
            await expect(
                makeCaller().getCompetencyMatrix({
                    organizationId: T.org,
                    skillId: T.skill1,
                    skillGroupId: T.grp1,
                }),
            ).rejects.toThrow(TRPCError);
        });

        it("rejects input with both skillGroupId and skillPackageId", async () => {
            await expect(
                makeCaller().getCompetencyMatrix({
                    organizationId: T.org,
                    skillGroupId: T.grp1,
                    skillPackageId: T.pkg1,
                }),
            ).rejects.toThrow(TRPCError);
        });
    });
});

describe("skillChecks.upsertSessionSkillChecks", () => {
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
        return skillChecksRouter.createCaller(
            createAuthenticatedMockContext({
                user: { id: userId },
                permissions: { organization: ["view"], skillCheck: ["create", "update"] },
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

    describe("createSkillCheck", () => {
        it("allows an assigned assessor to create a check on the session", async () => {
            const result = await makeCaller(T.assessorUser).createSkillCheck({
                organizationId: T.org,
                skillCheckId: nanoId16() as never,
                sessionId: T.session,
                create: {
                    assesseeId: T.assessee,
                    assessorId: T.assessorPerson,
                    skillId: T.skill2,
                    result: "Pass",
                    notes: "",
                },
            });

            expect(result.sessionId).toBe(T.session);
        });

        it("rejects a person who is not an assigned assessor for the session", async () => {
            await expect(
                makeCaller(T.otherUser).createSkillCheck({
                    organizationId: T.org,
                    skillCheckId: nanoId16() as never,
                    sessionId: T.session,
                    create: {
                        assesseeId: T.assessee,
                        assessorId: T.otherPerson,
                        skillId: T.skill1,
                        result: "Pass",
                        notes: "",
                    },
                }),
            ).rejects.toThrow(TRPCError);
        });

        it("rejects creating on a session with no assigned assessors at all", async () => {
            await expect(
                makeCaller(T.assessorUser).createSkillCheck({
                    organizationId: T.org,
                    skillCheckId: nanoId16() as never,
                    sessionId: T.unscopedSession,
                    create: {
                        assesseeId: T.assessee,
                        assessorId: T.assessorPerson,
                        skillId: T.skill1,
                        result: "Pass",
                        notes: "",
                    },
                }),
            ).rejects.toThrow(TRPCError);
        });

        it("allows creating a check with no session at all", async () => {
            const result = await makeCaller(T.otherUser).createSkillCheck({
                organizationId: T.org,
                skillCheckId: nanoId16() as never,
                sessionId: null,
                create: {
                    assesseeId: T.assessee,
                    assessorId: T.otherPerson,
                    skillId: T.skill1,
                    result: "Pass",
                    notes: "",
                },
            });

            expect(result.sessionId).toBeNull();
        });
    });

    describe("updateSkillCheck", () => {
        const check = nanoId16() as never;

        beforeAll(async () => {
            await db.skillCheck.create({
                data: {
                    id: check,
                    organizationId: T.org,
                    sessionId: T.session,
                    assesseeId: T.assessee,
                    assessorId: T.assessorPerson,
                    skillId: T.skill3,
                    result: "Pass",
                    notes: "original",
                    status: "Draft",
                },
            });
        });

        it("allows the recording assessor to update their own check", async () => {
            const result = await makeCaller(T.assessorUser).updateSkillCheck({
                organizationId: T.org,
                skillCheckId: check,
                update: { result: "StrongPass", notes: "updated" },
            });

            expect(result.notes).toBe("updated");
        });

        it("rejects a different assessor updating someone else's check", async () => {
            await expect(
                makeCaller(T.otherUser).updateSkillCheck({
                    organizationId: T.org,
                    skillCheckId: check,
                    update: { result: "Fail", notes: "hijacked" },
                }),
            ).rejects.toThrow(TRPCError);
        });
    });
});
