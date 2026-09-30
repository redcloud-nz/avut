/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { UserId } from "@/lib/schemas/user";
import { UserNoteId } from "@/lib/schemas/user-note";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { userNotesRouter } from "./user-notes-router";

describe("userNotesRouter", () => {
    const T = {
        owner: UserId.create(),
        other: UserId.create(),
        own: UserNoteId.create(),
        ownToDelete: UserNoteId.create(),
        others: UserNoteId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.owner, T.other]) {
            await db.user.create({ data: { id, name: id, email: `${id}@example.com` } });
        }

        const notes = [
            { id: T.own, userId: T.owner },
            { id: T.ownToDelete, userId: T.owner },
            { id: T.others, userId: T.other },
        ];
        for (const note of notes) {
            await db.userNote.create({
                data: { ...note, title: `Note ${note.id}`, content: "original body" },
            });
        }
    });

    function makeCaller(userId: UserId) {
        return userNotesRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: userId }, prisma: db }),
        );
    }

    async function logEntriesFor(objectId: string) {
        return db.logEntry.findMany({ where: { objectType: "UserNote", objectId } });
    }

    describe("createNote", () => {
        it("creates the note for the caller and logs a user-scoped Create entry", async () => {
            const { created } = await makeCaller(T.owner).createNote({
                title: "  Untitled note  ",
            });

            expect(created.userId).toBe(T.owner);
            expect(created.title).toBe("Untitled note");
            expect(created.content).toBe("");

            const entries = await logEntriesFor(created.id);
            expect(entries).toHaveLength(1);
            expect(entries[0].action).toBe("Create");
            expect(entries[0].scope).toBe("user");
            expect(entries[0].ownerId).toBe(T.owner);
            expect(entries[0].organizationId).toBeNull();
        });
    });

    describe("getNote / listNotes", () => {
        it("returns the caller's note", async () => {
            const note = await makeCaller(T.owner).getNote({ noteId: T.own });

            expect(note.content).toBe("original body");
        });

        it("throws NOT_FOUND for another user's note", async () => {
            await expect(makeCaller(T.owner).getNote({ noteId: T.others })).rejects.toMatchObject({
                code: "NOT_FOUND",
            });
        });

        it("lists only the caller's notes", async () => {
            const notes = await makeCaller(T.owner).listNotes();

            expect(notes.map((note) => note.id)).toContain(T.own);
            expect(notes.map((note) => note.id)).not.toContain(T.others);
        });
    });

    describe("updateNote", () => {
        it("updates the caller's note, logging the title diff and masking the body", async () => {
            const { updated } = await makeCaller(T.owner).updateNote({
                noteId: T.own,
                title: "Renamed",
                content: "rewritten body",
            });

            expect(updated.title).toBe("Renamed");
            expect(updated.content).toBe("rewritten body");

            const [entry] = await logEntriesFor(T.own);
            expect(entry.action).toBe("Update");
            expect(entry.scope).toBe("user");
            expect(entry.changes).toContainEqual({ type: "obj_mask", path: ["content"] });
            expect(JSON.stringify(entry.changes)).toContain("Renamed");
            expect(JSON.stringify(entry.changes)).not.toMatch(/original body|rewritten body/);
        });

        it("rejects an update with neither title nor content", async () => {
            await expect(makeCaller(T.owner).updateNote({ noteId: T.own })).rejects.toMatchObject({
                code: "BAD_REQUEST",
            });
        });

        it("throws NOT_FOUND for another user's note, leaving it unchanged", async () => {
            await expect(
                makeCaller(T.owner).updateNote({ noteId: T.others, title: "Hijacked" }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });

            expect((await db.userNote.findUnique({ where: { id: T.others } }))?.title).toBe(
                `Note ${T.others}`,
            );
        });
    });

    describe("deleteNote", () => {
        it("deletes the caller's note and logs a Delete entry with its title", async () => {
            const { deleted } = await makeCaller(T.owner).deleteNote({ noteId: T.ownToDelete });

            expect(deleted.id).toBe(T.ownToDelete);
            expect(await db.userNote.findUnique({ where: { id: T.ownToDelete } })).toBeNull();

            const [entry] = await logEntriesFor(T.ownToDelete);
            expect(entry.action).toBe("Delete");
            expect(entry.description).toBe(`Note ${T.ownToDelete}`);
        });

        it("throws NOT_FOUND for another user's note, leaving it in place", async () => {
            await expect(
                makeCaller(T.owner).deleteNote({ noteId: T.others }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });

            expect(await db.userNote.findUnique({ where: { id: T.others } })).not.toBeNull();
        });
    });
});
