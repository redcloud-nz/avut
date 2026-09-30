/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import type { Prisma } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";
import { UserId } from "@/lib/schemas/user";
import { UserNoteId } from "@/lib/schemas/user-note";
import { recordLogEntry, resolveActor } from "@/server/log-entry";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import type { LogEventOptions, UserServiceContext } from "./service-context";
import * as UserNotes from "./user-notes";

describe("user-notes", () => {
    const T = {
        user: UserId.create(),
        otherUser: UserId.create(),
        older: UserNoteId.create(),
        newer: UserNoteId.create(),
        others: UserNoteId.create(),
        toUpdate: UserNoteId.create(),
        toDelete: UserNoteId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.user, T.otherUser]) {
            await db.user.create({ data: { id, name: id, email: `${id}@example.com` } });
        }

        const notes = [
            { id: T.older, userId: T.user, title: "Older", updatedAt: "2026-01-01" },
            { id: T.newer, userId: T.user, title: "Newer", updatedAt: "2026-03-01" },
            { id: T.others, userId: T.otherUser, title: "Not yours", updatedAt: "2026-04-01" },
            { id: T.toUpdate, userId: T.user, title: "Before", updatedAt: "2025-01-01" },
            { id: T.toDelete, userId: T.user, title: "Doomed", updatedAt: "2025-01-01" },
        ];
        for (const { updatedAt, ...note } of notes) {
            await db.userNote.create({
                data: { ...note, content: "secret body", updatedAt: new Date(updatedAt) },
            });
        }
    });

    /** The context `authenticatedProcedure` builds: its `logEvent` writes to the user's own log. */
    function makeCtx(userId: UserId = T.user): UserServiceContext {
        const { auth } = createAuthenticatedMockContext({ user: { id: userId }, prisma: db });

        return {
            prisma: db,
            userId,
            logEvent: (options: LogEventOptions, tx: Prisma.TransactionClient = db) =>
                recordLogEntry(
                    { scope: "user", ownerId: userId, ...resolveActor(auth), ...options },
                    tx,
                ),
        };
    }

    async function logEntriesFor(objectId: string) {
        return db.logEntry.findMany({ where: { objectType: "UserNote", objectId } });
    }

    describe("list", () => {
        it("returns only the caller's notes, most recently updated first, without content", async () => {
            const notes = await UserNotes.list(makeCtx());

            expect(notes.map((note) => note.id)).toEqual([
                T.newer,
                T.older,
                T.toUpdate,
                T.toDelete,
            ]);
            expect(notes[0]).not.toHaveProperty("content");
        });
    });

    describe("requireById", () => {
        it("returns the caller's note in full", async () => {
            const note = await UserNotes.requireById(makeCtx(), T.older);

            expect(note.content).toBe("secret body");
        });

        it("throws NotFoundError for another user's note", async () => {
            await expect(UserNotes.requireById(makeCtx(), T.others)).rejects.toThrow(NotFoundError);
        });
    });

    describe("create", () => {
        it("owns the note as the caller and masks the body in a user-scoped log entry", async () => {
            const created = await UserNotes.create(makeCtx(), {
                title: "Fresh",
                content: "private thoughts",
            });

            expect(created.userId).toBe(T.user);

            const [entry] = await logEntriesFor(created.id);
            expect(entry.action).toBe("Create");
            expect(entry.scope).toBe("user");
            expect(entry.ownerId).toBe(T.user);
            expect(entry.changes).toContainEqual({ type: "obj_mask", path: ["content"] });
            expect(JSON.stringify(entry.changes)).not.toContain("private thoughts");
        });
    });

    describe("update", () => {
        it("logs the title diff and masks the body", async () => {
            const ctx = makeCtx();
            const updated = await UserNotes.update(
                ctx,
                await UserNotes.requireById(ctx, T.toUpdate),
                { title: "After", content: "new body" },
            );

            expect(updated.title).toBe("After");
            expect(updated.content).toBe("new body");

            const [entry] = await logEntriesFor(T.toUpdate);
            expect(entry.action).toBe("Update");
            expect(entry.changes).toContainEqual({ type: "obj_mask", path: ["content"] });
            expect(JSON.stringify(entry.changes)).not.toMatch(/secret body|new body/);
            expect(JSON.stringify(entry.changes)).toMatch(/After/);
        });

        it("is a no-op when nothing differs", async () => {
            const ctx = makeCtx();
            const existing = await UserNotes.requireById(ctx, T.older);

            await UserNotes.update(ctx, existing, { title: "Older", content: "secret body" });

            expect(await logEntriesFor(T.older)).toHaveLength(0);
        });
    });

    describe("remove", () => {
        it("hard-deletes the note and keeps its title in the log", async () => {
            const ctx = makeCtx();

            await UserNotes.remove(ctx, await UserNotes.requireById(ctx, T.toDelete));

            expect(await db.userNote.findUnique({ where: { id: T.toDelete } })).toBeNull();

            const [entry] = await logEntriesFor(T.toDelete);
            expect(entry.action).toBe("Delete");
            expect(entry.description).toBe("Doomed");
        });
    });
});
