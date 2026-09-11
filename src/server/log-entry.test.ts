/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import type { DiffChange } from "@/lib/diff";
import { nanoId16 } from "@/lib/id";
import { OrganizationId } from "@/lib/schemas/organization";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";

import {
    createLogBatch,
    formatActorLabel,
    LogEntryInvariantError,
    recordLogEntry,
    type RecordLogEntryInput,
} from "./log-entry";

const T = {
    org: OrganizationId.create(),
    actor: UserId.create(),
    owner: UserId.create(),
    admin: UserId.create(),
};

function baseInput(): RecordLogEntryInput {
    return {
        scope: "organization",
        organizationId: T.org,
        actor: { userId: T.actor },
        actorLabel: "Ada Lovelace <ada@example.com>",
        action: "Update",
        objectType: "Person",
        objectId: "person_1",
    };
}

describe("recordLogEntry — owner invariant", () => {
    const db = createMockPrisma();

    it("accepts organization scope with an organizationId and no ownerId", async () => {
        const entry = await recordLogEntry(baseInput(), db);
        expect(entry.scope).toBe("organization");
        expect(entry.organizationId).toBe(T.org);
        expect(entry.ownerId).toBeNull();
    });

    it("accepts user scope with an ownerId and no organizationId", async () => {
        const entry = await recordLogEntry(
            { ...baseInput(), scope: "user", organizationId: null, ownerId: T.owner },
            db,
        );
        expect(entry.scope).toBe("user");
        expect(entry.ownerId).toBe(T.owner);
        expect(entry.organizationId).toBeNull();
    });

    it("accepts system scope with neither", async () => {
        const entry = await recordLogEntry(
            { ...baseInput(), scope: "system", organizationId: null },
            db,
        );
        expect(entry.scope).toBe("system");
        expect(entry.organizationId).toBeNull();
        expect(entry.ownerId).toBeNull();
    });

    it("rejects organization scope without an organizationId", () => {
        expect(() => recordLogEntry({ ...baseInput(), organizationId: null }, db)).toThrow(
            LogEntryInvariantError,
        );
    });

    it("rejects organization scope carrying an ownerId", () => {
        expect(() => recordLogEntry({ ...baseInput(), ownerId: T.owner }, db)).toThrow(
            LogEntryInvariantError,
        );
    });

    it("rejects user scope without an ownerId", () => {
        expect(() =>
            recordLogEntry({ ...baseInput(), scope: "user", organizationId: null }, db),
        ).toThrow(LogEntryInvariantError);
    });

    it("rejects user scope carrying an organizationId", () => {
        expect(() =>
            recordLogEntry({ ...baseInput(), scope: "user", ownerId: T.owner }, db),
        ).toThrow(LogEntryInvariantError);
    });

    it("rejects system scope carrying an owner", () => {
        expect(() =>
            recordLogEntry(
                { ...baseInput(), scope: "system", organizationId: null, ownerId: T.owner },
                db,
            ),
        ).toThrow(LogEntryInvariantError);
    });
});

describe("recordLogEntry — actor invariant", () => {
    const db = createMockPrisma();

    it("records the acting user and their denormalized label", async () => {
        const entry = await recordLogEntry(baseInput(), db);
        expect(entry.userId).toBe(T.actor);
        expect(entry.actorLabel).toBe("Ada Lovelace <ada@example.com>");
    });

    it("records an impersonator alongside the acting user", async () => {
        const entry = await recordLogEntry(
            { ...baseInput(), actor: { userId: T.actor, impersonatorId: T.admin } },
            db,
        );
        expect(entry.userId).toBe(T.actor);
        expect(entry.impersonatorId).toBe(T.admin);
    });

    it("accepts a null actor when a batchId supplies the provenance", async () => {
        const batch = await createLogBatch(
            { operationKey: "d4h-team-sync", actorLabel: "D4H team sync" },
            db,
        );
        const entry = await recordLogEntry(
            { ...baseInput(), actor: null, batchId: batch.id, actorLabel: "D4H team sync" },
            db,
        );
        expect(entry.userId).toBeNull();
        expect(entry.batchId).toBe(batch.id);
        expect(entry.actorLabel).toBe("D4H team sync");
    });

    it("rejects an entry with neither an actor nor a batch — it has no provenance at all", () => {
        expect(() => recordLogEntry({ ...baseInput(), actor: null }, db)).toThrow(
            LogEntryInvariantError,
        );
    });
});

describe("recordLogEntry — refs fan-out", () => {
    const db = createMockPrisma();

    it("adds a primary ref mirroring objectType and objectId", async () => {
        const entry = await recordLogEntry(baseInput(), db);
        const objects = await db.logEntryObject.findMany({ where: { logEntryId: entry.id } });

        expect(objects).toHaveLength(1);
        expect(objects[0]).toMatchObject({
            objectType: "Person",
            objectId: "person_1",
            role: "primary",
        });
        expect(objects[0].objectType).toBe(entry.objectType);
        expect(objects[0].objectId).toBe(entry.objectId);
    });

    it("writes extra refs, defaulting their role to context", async () => {
        const entry = await recordLogEntry(
            {
                ...baseInput(),
                objectId: "skill_1",
                objectType: "Skill",
                action: "Move",
                refs: [
                    { objectType: "SkillPackage", objectId: "pkg_a", role: "from" },
                    { objectType: "SkillPackage", objectId: "pkg_b", role: "to" },
                    { objectType: "Team", objectId: "team_5" },
                ],
            },
            db,
        );

        const objects = await db.logEntryObject.findMany({ where: { logEntryId: entry.id } });
        expect(objects).toHaveLength(4);
        expect(objects.map((o) => [o.objectId, o.role]).sort()).toEqual(
            [
                ["pkg_a", "from"],
                ["pkg_b", "to"],
                ["skill_1", "primary"],
                ["team_5", "context"],
            ].sort(),
        );
    });

    it("drops a ref that duplicates the primary rather than writing a second row", async () => {
        const entry = await recordLogEntry(
            {
                ...baseInput(),
                refs: [{ objectType: "Person", objectId: "person_1", role: "context" }],
            },
            db,
        );

        const objects = await db.logEntryObject.findMany({ where: { logEntryId: entry.id } });
        expect(objects).toHaveLength(1);
        expect(objects[0].role).toBe("primary");
    });

    it("rejects a role off the closed union", () => {
        expect(() =>
            recordLogEntry(
                {
                    ...baseInput(),
                    refs: [
                        {
                            objectType: "Team",
                            objectId: "team_5",
                            role: "related" as never,
                        },
                    ],
                },
                db,
            ),
        ).toThrow(LogEntryInvariantError);
    });

    it("rejects a ref claiming the primary role for a different object", () => {
        // Would otherwise insert a second role='primary' row and violate
        // log_entry_objects_primary_unique, rolling back the caller's whole transaction.
        expect(() =>
            recordLogEntry(
                {
                    ...baseInput(),
                    refs: [
                        {
                            objectType: "Team",
                            objectId: "team_5",
                            role: "primary" as never,
                        },
                    ],
                },
                db,
            ),
        ).toThrow(LogEntryInvariantError);
    });

    it("rejects an objectType off the closed union", () => {
        expect(() => recordLogEntry({ ...baseInput(), objectType: "Widget" as never }, db)).toThrow(
            LogEntryInvariantError,
        );
    });

    it("rejects a ref objectType off the closed union", () => {
        expect(() =>
            recordLogEntry(
                {
                    ...baseInput(),
                    refs: [{ objectType: "Widget" as never, objectId: "widget_1" }],
                },
                db,
            ),
        ).toThrow(LogEntryInvariantError);
    });
});

describe("recordLogEntry — closed vocabularies", () => {
    const db = createMockPrisma();

    /*
     * `scope` and `action` are text columns, so a value off their unions has nothing else
     * standing between it and the database. `scope` matters most: `assertOwnerInvariant`
     * switches on it, so an unrecognised value would previously have fallen through the
     * switch and written an entry with neither owner invariant checked.
     */
    it("rejects a scope off the closed union, rather than writing an unguarded entry", async () => {
        expect(() => recordLogEntry({ ...baseInput(), scope: "global" as never }, db)).toThrow(
            LogEntryInvariantError,
        );

        expect(await db.logEntry.count({ where: { scope: "global" } })).toBe(0);
    });

    it("rejects a scope that would otherwise escape the owner invariant entirely", () => {
        // Neither an organization nor a user entry: `organization` scope requires an
        // organizationId and `user` scope requires an ownerId, so this would be rejected
        // under any recognised scope. It must be rejected under an unrecognised one too.
        expect(() =>
            recordLogEntry(
                { ...baseInput(), scope: "everything" as never, organizationId: null },
                db,
            ),
        ).toThrow(LogEntryInvariantError);
    });

    it("rejects an action off the closed union", () => {
        expect(() => recordLogEntry({ ...baseInput(), action: "Frobnicate" as never }, db)).toThrow(
            LogEntryInvariantError,
        );
    });
});

describe("recordLogEntry — changes parse", () => {
    const db = createMockPrisma();

    it("persists a valid DiffChange[] through the round trip", async () => {
        const changes: DiffChange[] = [{ type: "obj_mod", path: ["name"], prev: "a", curr: "b" }];

        const entry = await recordLogEntry({ ...baseInput(), changes }, db);

        expect(entry.changes).toEqual(changes);
    });

    it("rejects a malformed change", () => {
        const changes = [{ type: "obj_mod", path: ["name"], prev: "a" }] as never;

        expect(() => recordLogEntry({ ...baseInput(), changes }, db)).toThrow(ZodError);
    });
});

describe("recordLogEntry — ordering", () => {
    const db = createMockPrisma();

    it("assigns a distinct, increasing sequence to each entry", async () => {
        const first = await recordLogEntry(baseInput(), db);
        const second = await recordLogEntry(baseInput(), db);
        const third = await recordLogEntry(baseInput(), db);

        expect(typeof first.sequence).toBe("number");
        expect(second.sequence).toBeGreaterThan(first.sequence);
        expect(third.sequence).toBeGreaterThan(second.sequence);
    });
});

describe("createLogBatch", () => {
    const db = createMockPrisma();

    it("records the operation key and the initiating user", async () => {
        const batch = await createLogBatch(
            {
                operationKey: "d4h-team-import",
                userId: T.actor,
                actorLabel: "Ada Lovelace <ada@example.com>",
                description: "Imported members from D4H",
            },
            db,
        );

        expect(batch.operationKey).toBe("d4h-team-import");
        expect(batch.userId).toBe(T.actor);
        expect(batch.description).toBe("Imported members from D4H");
    });

    it("allows an unattended run with no initiating user", async () => {
        const batch = await createLogBatch(
            { operationKey: "d4h-team-sync", actorLabel: "D4H team sync" },
            db,
        );
        expect(batch.userId).toBeNull();
        expect(batch.actorLabel).toBe("D4H team sync");
    });

    it("rejects an operation key off the registry", () => {
        expect(() => createLogBatch({ operationKey: "not-a-real-operation" as never }, db)).toThrow(
            LogEntryInvariantError,
        );
    });

    it("rejects inherited object keys, which an `in` check would have accepted", () => {
        for (const key of ["constructor", "toString", "hasOwnProperty"]) {
            expect(() => createLogBatch({ operationKey: key as never }, db)).toThrow(
                LogEntryInvariantError,
            );
        }
    });
});

describe("deletion behaviour", () => {
    it("anonymises an actor's entries elsewhere but keeps them readable", async () => {
        const db = createMockPrisma();
        const actorId = UserId.create();

        await db.user.create({
            data: { id: actorId, name: "Ada Lovelace", email: "ada@example.com" },
        });
        await db.organization.create({
            data: { id: T.org, name: "Org", slug: `org-${nanoId16()}`, createdAt: new Date() },
        });

        await recordLogEntry(
            {
                ...baseInput(),
                actor: { userId: actorId },
                actorLabel: "Ada Lovelace <ada@example.com>",
            },
            db,
        );

        await db.user.delete({ where: { id: actorId } });

        const entries = await db.logEntry.findMany({ where: { organizationId: T.org } });
        expect(entries).toHaveLength(1);
        expect(entries[0].userId).toBeNull();
        expect(entries[0].actorLabel).toBe("Ada Lovelace <ada@example.com>");
    });

    it("removes a user's own scope-user log when they are deleted", async () => {
        const db = createMockPrisma();
        const ownerId = UserId.create();
        const adminId = UserId.create();

        await db.user.create({
            data: { id: ownerId, name: "Kim Park", email: "kim@example.com" },
        });
        await db.user.create({
            data: { id: adminId, name: "Dana Okafor", email: "dana@example.com" },
        });

        await recordLogEntry(
            {
                scope: "user",
                ownerId,
                actor: { userId: adminId },
                actorLabel: "Dana Okafor <dana@example.com>",
                action: "Ban",
                objectType: "User",
                objectId: ownerId,
            },
            db,
        );

        expect(await db.logEntry.count()).toBe(1);

        await db.user.delete({ where: { id: ownerId } });

        expect(await db.logEntry.count()).toBe(0);
    });
});

describe("formatActorLabel", () => {
    it("renders a name and email in the denormalized form", () => {
        expect(formatActorLabel("Ada Lovelace", "ada@example.com")).toBe(
            "Ada Lovelace <ada@example.com>",
        );
    });
});
