/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import { NotFoundError } from "@/lib/errors";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationNoteId } from "@/lib/schemas/organization-note";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createOrganizationMockContext } from "@/test/trpc-helpers";

import * as OrganizationNotes from "./organization-notes";

describe("organization-notes", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        user: UserId.create(),
        older: OrganizationNoteId.create(),
        newer: OrganizationNoteId.create(),
        authorless: OrganizationNoteId.create(),
        outsider: OrganizationNoteId.create(),
        toUpdate: OrganizationNoteId.create(),
        toDelete: OrganizationNoteId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }
        await db.user.create({
            data: { id: T.user, name: "Nora Notes", email: "nora@example.com" },
        });

        const notes = [
            { id: T.older, organizationId: T.org, authorId: T.user, updatedAt: "2026-01-01" },
            { id: T.newer, organizationId: T.org, authorId: T.user, updatedAt: "2026-03-01" },
            { id: T.authorless, organizationId: T.org, authorId: null, updatedAt: "2026-02-01" },
            {
                id: T.outsider,
                organizationId: T.otherOrg,
                authorId: T.user,
                updatedAt: "2026-04-01",
            },
        ];
        for (const { updatedAt, ...note } of notes) {
            await db.organizationNote.create({
                data: {
                    ...note,
                    title: `Note ${note.id}`,
                    content: "secret body",
                    updatedAt: new Date(updatedAt),
                },
            });
        }
        await db.organizationNote.create({
            data: {
                id: T.toUpdate,
                organizationId: T.otherOrg,
                authorId: T.user,
                title: "Before",
                content: "old body",
            },
        });
        await db.organizationNote.create({
            data: {
                id: T.toDelete,
                organizationId: T.otherOrg,
                authorId: T.user,
                title: "Doomed",
                content: "",
            },
        });
    });

    function makeCtx(organizationId: OrganizationId = T.org) {
        return createOrganizationMockContext({
            organizationId,
            user: { id: T.user },
            prisma: db,
        });
    }

    async function logEntriesFor(objectId: string) {
        return db.logEntry.findMany({ where: { objectType: "OrganizationNote", objectId } });
    }

    describe("list", () => {
        it("returns the organization's notes, most recently updated first, without content", async () => {
            const notes = await OrganizationNotes.list(makeCtx());

            expect(notes.map((note) => note.id)).toEqual([T.newer, T.authorless, T.older]);
            expect(notes[0]).not.toHaveProperty("content");
        });

        it("includes the author's name, or null once the author is gone", async () => {
            const notes = await OrganizationNotes.list(makeCtx());

            expect(notes.find((note) => note.id === T.newer)?.author).toEqual({
                id: T.user,
                name: "Nora Notes",
            });
            expect(notes.find((note) => note.id === T.authorless)?.author).toBeNull();
        });
    });

    describe("requireById", () => {
        it("returns the full note", async () => {
            const note = await OrganizationNotes.requireById(makeCtx(), T.older);

            expect(note.content).toBe("secret body");
        });

        it("throws NotFoundError for a note in another organization", async () => {
            await expect(OrganizationNotes.requireById(makeCtx(), T.outsider)).rejects.toThrow(
                NotFoundError,
            );
        });
    });

    describe("create", () => {
        it("authors the note as the caller and masks the body in the log", async () => {
            const created = await OrganizationNotes.create(makeCtx(), {
                title: "Fresh",
                content: "private thoughts",
            });

            expect(created.authorId).toBe(T.user);
            expect(created.organizationId).toBe(T.org);

            const [entry] = await logEntriesFor(created.id);
            expect(entry.action).toBe("Create");
            expect(JSON.stringify(entry.changes)).not.toContain("private thoughts");
            expect(entry.changes).toContainEqual({ type: "obj_mask", path: ["content"] });
        });
    });

    describe("update", () => {
        it("logs the title diff and masks the body", async () => {
            const ctx = makeCtx(T.otherOrg);
            const updated = await OrganizationNotes.update(ctx, T.toUpdate, {
                title: "After",
                content: "new body",
            });

            expect(updated.title).toBe("After");
            expect(updated.content).toBe("new body");

            const [entry] = await logEntriesFor(T.toUpdate);
            expect(entry.action).toBe("Update");
            expect(entry.changes).toContainEqual({ type: "obj_mask", path: ["content"] });
            expect(JSON.stringify(entry.changes)).not.toMatch(/old body|new body/);
            expect(JSON.stringify(entry.changes)).toMatch(/After/);
        });

        it("is a no-op when nothing differs", async () => {
            const before = await logEntriesFor(T.older);

            await OrganizationNotes.update(makeCtx(), T.older, { content: "secret body" });

            expect(await logEntriesFor(T.older)).toHaveLength(before.length);
        });
    });

    describe("remove", () => {
        it("hard-deletes the note and keeps its title in the log", async () => {
            await OrganizationNotes.remove(makeCtx(T.otherOrg), T.toDelete);

            expect(await db.organizationNote.findUnique({ where: { id: T.toDelete } })).toBeNull();

            const [entry] = await logEntriesFor(T.toDelete);
            expect(entry.action).toBe("Delete");
            expect(entry.description).toBe("Doomed");
        });
    });
});
