/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { diffObject, type DiffChange } from "@/lib/diff";
import { NotFoundError } from "@/lib/errors";
import {
    UserNoteData,
    UserNoteId,
    type CreateUserNoteData,
    type UpdateUserNoteData,
    type UserNoteListItem,
} from "@/lib/schemas/user-note";

import type { UserServiceContext } from "./service-context";

/** List the calling user's notes, most recently updated first. */
export async function list(ctx: UserServiceContext): Promise<UserNoteListItem[]> {
    const notes = await ctx.prisma.userNote.findMany({
        where: { userId: ctx.userId },
        select: { id: true, title: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
    });

    return notes.map((note) => ({
        id: UserNoteId.schema.parse(note.id),
        title: note.title,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
    }));
}

/**
 * Fetch one of the calling user's notes by ID, or `null` if they have no such note — another
 * user's note is indistinguishable from a missing one. Callers that need the note to exist
 * should use `requireById` instead.
 */
export async function getById(
    ctx: UserServiceContext,
    noteId: UserNoteId,
): Promise<UserNoteData | null> {
    const note = await ctx.prisma.userNote.findUnique({
        where: { id: noteId, userId: ctx.userId },
    });

    return note ? UserNoteData.fromRecord(note) : null;
}

/**
 * Fetch one of the calling user's notes by ID.
 * @throws NotFoundError if the user has no such note (including when it belongs to someone else).
 */
export async function requireById(
    ctx: UserServiceContext,
    noteId: UserNoteId,
): Promise<UserNoteData> {
    const note = await getById(ctx, noteId);

    if (!note) {
        throw new NotFoundError(`UserNote(id=${noteId}) not found.`);
    }

    return note;
}

/**
 * Create a note owned by the calling user. The body is never copied into the log: a non-empty
 * body is recorded as a bare `obj_mask` marker.
 */
export async function create(
    ctx: UserServiceContext,
    input: CreateUserNoteData,
): Promise<UserNoteData> {
    const id = UserNoteId.create();
    const content = input.content ?? "";

    const changes: DiffChange[] = diffObject({}, { title: input.title });
    if (content !== "") changes.push({ type: "obj_mask", path: ["content"] });

    const [created] = await ctx.prisma.$transaction([
        ctx.prisma.userNote.create({
            data: { id, userId: ctx.userId, title: input.title, content },
        }),
        ctx.logEvent({ action: "Create", objectType: "UserNote", objectId: id, changes }),
    ]);

    return UserNoteData.fromRecord(created);
}

/**
 * Update a note's title and/or body. No-op, returning the existing note unchanged, if neither
 * differs. The log carries the title diff and, when the body changed, only an `obj_mask` marker.
 *
 * Takes the note the caller already loaded with `requireById`. The write stays scoped to the
 * calling user.
 */
export async function update(
    ctx: UserServiceContext,
    existing: UserNoteData,
    input: UpdateUserNoteData,
): Promise<UserNoteData> {
    const noteId = existing.id;

    const changes: DiffChange[] =
        input.title === undefined
            ? []
            : diffObject({ title: existing.title }, { title: input.title });
    if (input.content !== undefined && input.content !== existing.content) {
        changes.push({ type: "obj_mask", path: ["content"] });
    }

    if (changes.length === 0) return existing;

    const [updated] = await ctx.prisma.$transaction([
        ctx.prisma.userNote.update({
            where: { id: noteId, userId: ctx.userId },
            data: { title: input.title, content: input.content },
        }),
        ctx.logEvent({ action: "Update", objectType: "UserNote", objectId: noteId, changes }),
    ]);

    return UserNoteData.fromRecord(updated);
}

/**
 * Permanently delete a note. Notes aren't in the Rubbish bin, so this is a hard delete; the log
 * entry's description keeps the title.
 *
 * Takes the note the caller already loaded with `requireById`. The write stays scoped to the
 * calling user.
 */
export async function remove(
    ctx: UserServiceContext,
    existing: UserNoteData,
): Promise<UserNoteData> {
    const noteId = existing.id;

    await ctx.prisma.$transaction([
        ctx.prisma.userNote.delete({ where: { id: noteId, userId: ctx.userId } }),
        ctx.logEvent({
            action: "Delete",
            objectType: "UserNote",
            objectId: noteId,
            description: existing.title,
        }),
    ]);

    return existing;
}
