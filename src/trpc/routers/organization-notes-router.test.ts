/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { beforeAll, describe, expect, it } from "vitest";

import type { Permissions } from "@/lib/permissions";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationNoteId } from "@/lib/schemas/organization-note";
import { UserId } from "@/lib/schemas/user";
import { createMockPrisma } from "@/test/create-prisma-mock";
import { createAuthenticatedMockContext } from "@/test/trpc-helpers";

import { organizationNotesRouter } from "./organization-notes-router";

// `organizationProcedure` always folds in `organization: ["view"]`, and the mock's
// `hasPermission` checks statements literally, so each fixture spells out its grants.
const MEMBER: Permissions = {
    organization: ["view"],
    organizationNote: ["view", "create"],
};
const ADMIN: Permissions = {
    organization: ["view"],
    organizationNote: ["view", "create", "update", "delete"],
};

describe("organizationNotesRouter", () => {
    const T = {
        org: OrganizationId.create(),
        otherOrg: OrganizationId.create(),
        author: UserId.create(),
        member: UserId.create(),
        admin: UserId.create(),
        /** The author's own note, edited and deleted by the author. */
        own: OrganizationNoteId.create(),
        ownToDelete: OrganizationNoteId.create(),
        /** The author's note, which the member may not touch and the admin may. */
        othersNote: OrganizationNoteId.create(),
        othersToDelete: OrganizationNoteId.create(),
        authorless: OrganizationNoteId.create(),
        outsider: OrganizationNoteId.create(),
    };

    const db = createMockPrisma();

    beforeAll(async () => {
        for (const id of [T.org, T.otherOrg]) {
            await db.organization.create({
                data: { id, name: id, slug: id, createdAt: new Date() },
            });
        }
        for (const id of [T.author, T.member, T.admin]) {
            await db.user.create({ data: { id, name: id, email: `${id}@example.com` } });
        }

        const notes = [
            { id: T.own, organizationId: T.org, authorId: T.author },
            { id: T.ownToDelete, organizationId: T.org, authorId: T.author },
            { id: T.othersNote, organizationId: T.org, authorId: T.author },
            { id: T.othersToDelete, organizationId: T.org, authorId: T.author },
            { id: T.authorless, organizationId: T.org, authorId: null },
            { id: T.outsider, organizationId: T.otherOrg, authorId: T.author },
        ];
        for (const note of notes) {
            await db.organizationNote.create({
                data: { ...note, title: `Note ${note.id}`, content: "original body" },
            });
        }
    });

    function makeCaller(userId: UserId, permissions: Permissions) {
        return organizationNotesRouter.createCaller(
            createAuthenticatedMockContext({ user: { id: userId }, permissions, prisma: db }),
        );
    }

    async function logEntriesFor(objectId: string) {
        return db.logEntry.findMany({ where: { objectType: "OrganizationNote", objectId } });
    }

    describe("createNote", () => {
        it("creates the note authored by the caller and logs a Create entry", async () => {
            const { created } = await makeCaller(T.member, MEMBER).createNote({
                organizationId: T.org,
                title: "  Untitled note  ",
            });

            expect(created.authorId).toBe(T.member);
            expect(created.title).toBe("Untitled note");
            expect(created.content).toBe("");

            const entries = await logEntriesFor(created.id);
            expect(entries).toHaveLength(1);
            expect(entries[0].action).toBe("Create");
            expect(entries[0].userId).toBe(T.member);
        });
    });

    describe("getNote / listNotes", () => {
        it("returns a note in the organization", async () => {
            const note = await makeCaller(T.member, MEMBER).getNote({
                organizationId: T.org,
                noteId: T.own,
            });

            expect(note.content).toBe("original body");
        });

        it("throws NOT_FOUND for a note in another organization", async () => {
            await expect(
                makeCaller(T.admin, ADMIN).getNote({ organizationId: T.org, noteId: T.outsider }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
        });

        it("lists only the organization's notes", async () => {
            const notes = await makeCaller(T.member, MEMBER).listNotes({ organizationId: T.org });

            expect(notes.map((note) => note.id)).not.toContain(T.outsider);
            expect(notes.find((note) => note.id === T.authorless)?.author).toBeNull();
        });
    });

    describe("updateNote", () => {
        it("lets the author update their own note, logging the title diff and masking the body", async () => {
            const { updated } = await makeCaller(T.author, MEMBER).updateNote({
                organizationId: T.org,
                noteId: T.own,
                title: "Renamed",
                content: "rewritten body",
            });

            expect(updated.title).toBe("Renamed");
            expect(updated.content).toBe("rewritten body");

            const [entry] = await logEntriesFor(T.own);
            expect(entry.action).toBe("Update");
            expect(entry.changes).toContainEqual({ type: "obj_mask", path: ["content"] });
            expect(JSON.stringify(entry.changes)).toContain("Renamed");
            expect(JSON.stringify(entry.changes)).not.toMatch(/original body|rewritten body/);
        });

        it("rejects an update with neither title nor content", async () => {
            await expect(
                makeCaller(T.author, MEMBER).updateNote({ organizationId: T.org, noteId: T.own }),
            ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        });

        it("throws NOT_FOUND for a note in another organization", async () => {
            await expect(
                makeCaller(T.admin, ADMIN).updateNote({
                    organizationId: T.org,
                    noteId: T.outsider,
                    title: "Nope",
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
        });

        // The author check must never run ahead of org scoping: authoring a note elsewhere
        // doesn't make it reachable through this organization.
        it("throws NOT_FOUND to the author for their own note in another organization", async () => {
            await expect(
                makeCaller(T.author, MEMBER).updateNote({
                    organizationId: T.org,
                    noteId: T.outsider,
                    title: "Nope",
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
        });

        it("forbids a member from updating someone else's note", async () => {
            await expect(
                makeCaller(T.member, MEMBER).updateNote({
                    organizationId: T.org,
                    noteId: T.othersNote,
                    title: "Hijacked",
                }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        });

        it("forbids a member from updating an authorless note", async () => {
            await expect(
                makeCaller(T.member, MEMBER).updateNote({
                    organizationId: T.org,
                    noteId: T.authorless,
                    title: "Hijacked",
                }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        });

        it("lets an admin update someone else's note", async () => {
            const { updated } = await makeCaller(T.admin, ADMIN).updateNote({
                organizationId: T.org,
                noteId: T.othersNote,
                title: "Edited by admin",
            });

            expect(updated.title).toBe("Edited by admin");
        });

        it("lets an admin update an authorless note", async () => {
            const { updated } = await makeCaller(T.admin, ADMIN).updateNote({
                organizationId: T.org,
                noteId: T.authorless,
                content: "adopted",
            });

            expect(updated.content).toBe("adopted");
        });
    });

    describe("deleteNote", () => {
        it("lets the author delete their own note", async () => {
            await makeCaller(T.author, MEMBER).deleteNote({
                organizationId: T.org,
                noteId: T.ownToDelete,
            });

            expect(
                await db.organizationNote.findUnique({ where: { id: T.ownToDelete } }),
            ).toBeNull();
        });

        it("throws NOT_FOUND for a note in another organization", async () => {
            await expect(
                makeCaller(T.admin, ADMIN).deleteNote({
                    organizationId: T.org,
                    noteId: T.outsider,
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });
        });

        it("throws NOT_FOUND to the author for their own note in another organization", async () => {
            await expect(
                makeCaller(T.author, MEMBER).deleteNote({
                    organizationId: T.org,
                    noteId: T.outsider,
                }),
            ).rejects.toMatchObject({ code: "NOT_FOUND" });

            expect(
                await db.organizationNote.findUnique({ where: { id: T.outsider } }),
            ).not.toBeNull();
        });

        it("forbids a member from deleting someone else's note", async () => {
            await expect(
                makeCaller(T.member, MEMBER).deleteNote({
                    organizationId: T.org,
                    noteId: T.othersToDelete,
                }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });

            expect(
                await db.organizationNote.findUnique({ where: { id: T.othersToDelete } }),
            ).not.toBeNull();
        });

        it("forbids a member from deleting an authorless note", async () => {
            await expect(
                makeCaller(T.member, MEMBER).deleteNote({
                    organizationId: T.org,
                    noteId: T.authorless,
                }),
            ).rejects.toMatchObject({ code: "FORBIDDEN" });
        });

        it("lets an admin delete someone else's note", async () => {
            const { deleted } = await makeCaller(T.admin, ADMIN).deleteNote({
                organizationId: T.org,
                noteId: T.othersToDelete,
            });

            expect(deleted.id).toBe(T.othersToDelete);

            const [entry] = await logEntriesFor(T.othersToDelete);
            expect(entry.action).toBe("Delete");
            expect(entry.description).toBe(`Note ${T.othersToDelete}`);
        });
    });
});
