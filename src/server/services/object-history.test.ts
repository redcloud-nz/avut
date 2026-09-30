/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import type { DiffChange } from "@/lib/diff";
import { nanoId16 } from "@/lib/id";
import { LogBatchId, LogEntryId, LogEntryObjectId, LogObjectType } from "@/lib/schemas/log-entry";
import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { SkillPackageSubscriptionId } from "@/lib/schemas/skill-package-subscription";
import { TeamId } from "@/lib/schemas/team";
import { TeamMembershipId } from "@/lib/schemas/team-membership";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";

import * as ObjectHistory from "./object-history";

describe("ObjectHistory.list", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: UserId.create(),
        impersonator: UserId.create(),
        person: PersonId.create(),
        otherPerson: PersonId.create(),
        unattendedPerson: PersonId.create(),
        team: TeamId.create(),
        // Referenced by a log entry, but the row itself has been purged.
        purgedTeam: TeamId.create(),
        membership: TeamMembershipId.create(),
        purgedMembership: TeamMembershipId.create(),
        orgMembership: nanoId16(),
        batch: LogBatchId.create(),
        skillPackage: SkillPackageId.create(),
    };

    const db = createMockPrisma();
    const ctx = { prisma: db, organizationId: T.org };

    const allTypes = LogObjectType.values;
    const created: DiffChange[] = [{ type: "obj_add", path: ["name"], curr: "Pat Person" }];

    /** Sequences of the seeded entries, oldest first. */
    const SEQ = {
        create: 1,
        teamMembership: 2,
        orgMembership: 3,
        deletedActor: 4,
        batched: 5,
        purgedRefs: 6,
        otherOrg: 7,
        unrelated: 8,
        unattended: 9,
    };

    async function log(entry: {
        sequence: number;
        organizationId?: OrganizationId;
        userId?: UserId | null;
        impersonatorId?: UserId;
        actorLabel?: string;
        batchId?: string;
        action: string;
        objectType: string;
        objectId: string;
        changes?: unknown;
        description?: string;
        refs?: { objectType: string; objectId: string }[];
    }) {
        const { refs = [], organizationId = T.org, userId = T.user, changes = [], ...rest } = entry;
        await db.logEntry.create({
            data: {
                id: LogEntryId.create(),
                scope: "organization",
                organizationId,
                userId,
                changes: changes as never,
                ...rest,
                objects: {
                    create: [
                        {
                            id: LogEntryObjectId.create(),
                            objectType: entry.objectType,
                            objectId: entry.objectId,
                            role: "primary",
                        },
                        ...refs.map((ref) => ({
                            id: LogEntryObjectId.create(),
                            role: "context",
                            ...ref,
                        })),
                    ],
                },
            },
        });
    }

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }
        for (const [id, name] of [
            [T.user, "Una User"],
            [T.impersonator, "Ima Admin"],
        ] as const) {
            await db.user.create({ data: { id, name, email: `${id}@example.com` } });
        }
        for (const [id, name] of [
            [T.person, "Pat Person"],
            [T.otherPerson, "Olly Other"],
        ] as const) {
            await db.person.create({
                data: { id, organizationId: T.org, name, email: `${id}@example.com` },
            });
        }
        await db.team.create({ data: { id: T.team, organizationId: T.org, name: "Rescue 1" } });
        await db.logBatch.create({ data: { id: T.batch, operationKey: "d4h-team-sync" } });

        await log({
            sequence: SEQ.create,
            action: "Create",
            objectType: "Person",
            objectId: T.person,
            actorLabel: "Una User <una@example.com>",
            changes: created,
        });
        await log({
            sequence: SEQ.teamMembership,
            action: "Create",
            objectType: "TeamMembership",
            objectId: T.membership,
            refs: [
                { objectType: "Person", objectId: T.person },
                { objectType: "Team", objectId: T.team },
            ],
        });
        await log({
            sequence: SEQ.orgMembership,
            action: "Update",
            objectType: "OrganizationMembership",
            objectId: T.orgMembership,
            description: "Linked to user",
            refs: [{ objectType: "Person", objectId: T.person }],
        });
        await log({
            sequence: SEQ.deletedActor,
            userId: null,
            actorLabel: "Gone User <gone@example.com>",
            action: "Update",
            objectType: "Person",
            objectId: T.person,
            changes: [{ type: "not_a_change" }],
        });
        await log({
            sequence: SEQ.batched,
            impersonatorId: T.impersonator,
            batchId: T.batch,
            action: "Update",
            objectType: "Person",
            objectId: T.person,
        });
        await log({
            sequence: SEQ.purgedRefs,
            action: "Delete",
            objectType: "TeamMembership",
            objectId: T.purgedMembership,
            refs: [
                { objectType: "Person", objectId: T.person },
                { objectType: "Team", objectId: T.purgedTeam },
            ],
        });
        // The same object id, logged by another organization.
        await log({
            sequence: SEQ.otherOrg,
            organizationId: T.otherOrg,
            action: "Update",
            objectType: "Person",
            objectId: T.person,
        });
        // Nothing to do with the asked-for person. Its ref is of a type that isn't resolved.
        await log({
            sequence: SEQ.unrelated,
            action: "Update",
            objectType: "Person",
            objectId: T.otherPerson,
            refs: [{ objectType: "SkillPackage", objectId: T.skillPackage }],
        });
        // An unattended run (e.g. the Rubbish bin auto-purge): no user, and `actorLabel` is the
        // operation's label, not a person's.
        await log({
            sequence: SEQ.unattended,
            userId: null,
            actorLabel: "D4H team sync",
            batchId: T.batch,
            action: "Update",
            objectType: "Person",
            objectId: T.unattendedPerson,
        });
    });

    const listPerson = (
        overrides: Partial<
            Omit<ObjectHistory.ListObjectHistoryInput, "objectType" | "objectId">
        > = {},
    ) =>
        ObjectHistory.list(ctx, {
            objectType: "Person",
            objectId: T.person,
            relatedTypes: allTypes,
            limit: 50,
            ...overrides,
        });

    it("returns primary and related entries, newest first, scoped to the organization", async () => {
        const { entries, nextCursor } = await listPerson();

        expect(entries.map((e) => [e.sequence, e.relation])).toEqual([
            [SEQ.purgedRefs, "related"],
            [SEQ.batched, "primary"],
            [SEQ.deletedActor, "primary"],
            [SEQ.orgMembership, "related"],
            [SEQ.teamMembership, "related"],
            [SEQ.create, "primary"],
        ]);
        expect(nextCursor).toBeNull();
    });

    it("leaves out a related entry whose type isn't in relatedTypes", async () => {
        const { entries } = await listPerson({
            relatedTypes: allTypes.filter((t) => t !== "OrganizationMembership"),
        });

        expect(entries.map((e) => e.sequence)).not.toContain(SEQ.orgMembership);
        expect(entries.map((e) => e.sequence)).toContain(SEQ.teamMembership);
    });

    it("keeps primary entries even when their own type isn't in relatedTypes", async () => {
        const { entries } = await listPerson({ relatedTypes: [] });

        expect(entries.map((e) => e.sequence)).toEqual([SEQ.batched, SEQ.deletedActor, SEQ.create]);
    });

    it("has no nextCursor when exactly limit entries match", async () => {
        const { entries, nextCursor } = await listPerson({ limit: 6 });

        expect(entries).toHaveLength(6);
        expect(nextCursor).toBeNull();
    });

    it("returns a nextCursor when there are more, and continues from it", async () => {
        const first = await listPerson({ limit: 5 });

        expect(first.entries).toHaveLength(5);
        expect(first.nextCursor).toBe(SEQ.teamMembership);

        const second = await listPerson({ limit: 5, cursor: first.nextCursor! });

        expect(second.entries.map((e) => e.sequence)).toEqual([SEQ.create]);
        expect(second.nextCursor).toBeNull();
    });

    it("names the actor from the user, never the email", async () => {
        const { entries } = await listPerson();
        const create = entries.find((e) => e.sequence === SEQ.create)!;

        expect(create.actorName).toBe("Una User");
        expect(create.impersonatorName).toBeNull();
        expect(create.operationLabel).toBeNull();
        expect(create.changes).toEqual(created);
    });

    it("falls back to actorLabel without its email when the user is gone", async () => {
        const { entries } = await listPerson();

        expect(entries.find((e) => e.sequence === SEQ.deletedActor)!.actorName).toBe("Gone User");
    });

    it("returns the impersonator's name and the batch's operation label", async () => {
        const { entries } = await listPerson();
        const batched = entries.find((e) => e.sequence === SEQ.batched)!;

        expect(batched.impersonatorName).toBe("Ima Admin");
        expect(batched.operationLabel).toBe("D4H team sync");
    });

    it("gives an unattended run no actor name, only its operation label", async () => {
        const { entries } = await ObjectHistory.list(ctx, {
            objectType: "Person",
            objectId: T.unattendedPerson,
            relatedTypes: allTypes,
            limit: 50,
        });

        expect(entries).toHaveLength(1);
        expect(entries[0].actorName).toBeNull();
        expect(entries[0].operationLabel).toBe("D4H team sync");
    });

    it("reads malformed changes as none", async () => {
        const { entries } = await listPerson();

        expect(entries.find((e) => e.sequence === SEQ.deletedActor)!.changes).toEqual([]);
    });

    it("resolves refs other than the asked-for object and the entry's own", async () => {
        const { entries } = await listPerson();

        expect(entries.find((e) => e.sequence === SEQ.teamMembership)!.refs).toEqual([
            { objectType: "Team", role: "context", team: { id: T.team, name: "Rescue 1" } },
        ]);
        expect(entries.find((e) => e.sequence === SEQ.orgMembership)!.refs).toEqual([]);
    });

    it("returns a purged ref as null", async () => {
        const { entries } = await listPerson();

        expect(entries.find((e) => e.sequence === SEQ.purgedRefs)!.refs).toEqual([
            { objectType: "Team", role: "context", team: null },
        ]);
    });

    it("returns a ref the caller can't view as null", async () => {
        const { entries } = await listPerson({
            relatedTypes: allTypes.filter((t) => t !== "Team"),
        });

        expect(entries.find((e) => e.sequence === SEQ.teamMembership)!.refs).toEqual([
            { objectType: "Team", role: "context", team: null },
        ]);
    });

    it("keeps refs of other types by id", async () => {
        const { entries } = await ObjectHistory.list(ctx, {
            objectType: "Person",
            objectId: T.otherPerson,
            relatedTypes: allTypes,
            limit: 50,
        });

        expect(entries.map((e) => e.sequence)).toEqual([SEQ.unrelated]);
        expect(entries[0].refs).toEqual([
            { objectType: "SkillPackage", role: "context", objectId: T.skillPackage },
        ]);
    });

    it("resolves a Person ref on a Team's history", async () => {
        const { entries } = await ObjectHistory.list(ctx, {
            objectType: "Team",
            objectId: T.team,
            relatedTypes: allTypes,
            limit: 50,
        });

        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ relation: "related", objectType: "TeamMembership" });
        expect(entries[0].refs).toEqual([
            {
                objectType: "Person",
                role: "context",
                person: { id: T.person, name: "Pat Person" },
            },
        ]);
    });
});

describe("ObjectHistory.list names for IdFields changes", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: UserId.create(),
        session: SkillCheckSessionId.create(),
        assessee: PersonId.create(),
        assessor: PersonId.create(),
        purgedPerson: PersonId.create(),
        // A real person whose id only appears in a field that isn't in IdFields.
        bystander: PersonId.create(),
        // Another org's person, named by a stray id.
        otherOrgPerson: PersonId.create(),
        ownPackage: SkillPackageId.create(),
        subscribedPackage: SkillPackageId.create(),
        foreignPackage: SkillPackageId.create(),
        // Another org's package the org has since unsubscribed from; its skill is still linked
        // to one of the org's sessions.
        unsubscribedPackage: SkillPackageId.create(),
        ownSkill: SkillId.create(),
        subscribedSkill: SkillId.create(),
        foreignSkill: SkillId.create(),
        unsubscribedSkill: SkillId.create(),
    };

    const db = createMockPrisma();
    const ctx = { prisma: db, organizationId: T.org };

    const changes: DiffChange[] = [
        { type: "arr_add", path: ["assessees"], value: T.assessee },
        { type: "arr_add", path: ["assessees"], value: T.purgedPerson },
        { type: "arr_add", path: ["assessees"], value: T.otherOrgPerson },
        { type: "obj_mod", path: ["assessors"], prev: null, curr: [T.assessor] },
        { type: "arr_add", path: ["skills"], value: T.ownSkill },
        { type: "arr_add", path: ["skills"], value: T.subscribedSkill },
        { type: "arr_del", path: ["skills"], value: T.foreignSkill },
        { type: "arr_add", path: ["skills"], value: T.unsubscribedSkill },
        // Not in IdFields, though it holds an id.
        { type: "obj_mod", path: ["name"], prev: "Old", curr: T.bystander },
    ];

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }
        await db.user.create({ data: { id: T.user, name: "Una User", email: "una@example.com" } });
        for (const [id, organizationId, name] of [
            [T.assessee, T.org, "Ava Assessee"],
            [T.assessor, T.org, "Abe Assessor"],
            [T.bystander, T.org, "Bea Bystander"],
            [T.otherOrgPerson, T.otherOrg, "Olly Other"],
        ] as const) {
            await db.person.create({
                data: { id, organizationId, name, email: `${id}@example.com` },
            });
        }
        for (const [packageId, organizationId, skillId, name] of [
            [T.ownPackage, T.org, T.ownSkill, "Knots"],
            [T.subscribedPackage, T.otherOrg, T.subscribedSkill, "Radio"],
            [T.foreignPackage, T.otherOrg, T.foreignSkill, "Secret"],
            [T.unsubscribedPackage, T.otherOrg, T.unsubscribedSkill, "Ropes"],
        ] as const) {
            const skillGroupId = SkillGroupId.create();
            await db.skillPackage.create({
                data: { id: packageId, organizationId, name: packageId, description: "" },
            });
            await db.skillGroup.create({
                data: { id: skillGroupId, skillPackageId: packageId, name: "G", description: "" },
            });
            await db.skill.create({
                data: {
                    id: skillId,
                    skillPackageId: packageId,
                    skillGroupId,
                    name,
                    description: "",
                },
            });
        }
        await db.skillPackageSubscription.create({
            data: {
                id: SkillPackageSubscriptionId.create(),
                organizationId: T.org,
                skillPackageId: T.subscribedPackage,
            },
        });
        // The org's own session still links the unsubscribed package's skill. The foreign skill
        // is linked only to the other org's session, which doesn't count.
        for (const [id, organizationId, skillId] of [
            [T.session, T.org, T.unsubscribedSkill],
            [SkillCheckSessionId.create(), T.otherOrg, T.foreignSkill],
        ] as const) {
            await db.skillCheckSession.create({
                data: {
                    id,
                    organizationId,
                    name: "Session",
                    sessionNumber: 1,
                    skills: { connect: [{ id: skillId }] },
                },
            });
        }

        await db.logEntry.create({
            data: {
                id: LogEntryId.create(),
                sequence: 1,
                scope: "organization",
                organizationId: T.org,
                userId: T.user,
                action: "Update",
                objectType: "SkillCheckSession",
                objectId: T.session,
                changes: changes as never,
                objects: {
                    create: [
                        {
                            id: LogEntryObjectId.create(),
                            objectType: "SkillCheckSession",
                            objectId: T.session,
                            role: "primary",
                        },
                        // Also named in `assessees`, so the Person lookup is shared.
                        {
                            id: LogEntryObjectId.create(),
                            objectType: "Person",
                            objectId: T.assessee,
                            role: "context",
                        },
                    ],
                },
            },
        });
    });

    const listSession = (relatedTypes: readonly LogObjectType[] = LogObjectType.values) =>
        ObjectHistory.list(ctx, {
            objectType: "SkillCheckSession",
            objectId: T.session,
            relatedTypes,
            limit: 50,
        });

    it("keeps a Person ref gated even when its id also resolves for a change", async () => {
        const { entries, names } = await listSession(
            LogObjectType.values.filter((t) => t !== "Person"),
        );

        expect(entries[0].refs).toEqual([{ objectType: "Person", role: "context", person: null }]);
        expect(names.Person[T.assessee]).toBe("Ava Assessee");
    });

    it("resolves Person ids in arr_add values and array values, org-scoped", async () => {
        const { names } = await listSession();

        expect(names.Person).toEqual({
            [T.assessee]: "Ava Assessee",
            [T.assessor]: "Abe Assessor",
        });
    });

    it("leaves a purged id absent", async () => {
        const { names } = await listSession();

        expect(names.Person).not.toHaveProperty(T.purgedPerson);
    });

    it("resolves skills from owned and subscribed packages, but not another org's", async () => {
        const { names } = await listSession();

        expect(names.Skill).toMatchObject({ [T.ownSkill]: "Knots", [T.subscribedSkill]: "Radio" });
        expect(names.Skill).not.toHaveProperty(T.foreignSkill);
    });

    it("resolves a skill from an unsubscribed package that's linked to the org's session", async () => {
        const { names } = await listSession();

        expect(names.Skill).toEqual({
            [T.ownSkill]: "Knots",
            [T.subscribedSkill]: "Radio",
            [T.unsubscribedSkill]: "Ropes",
        });
    });

    it("leaves a field not in IdFields alone", async () => {
        const { entries, names } = await listSession();

        expect(names.Person).not.toHaveProperty(T.bystander);
        expect(entries[0].changes).toEqual(changes);
    });
});
