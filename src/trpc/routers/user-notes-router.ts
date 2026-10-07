/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { NoteUpdateInput } from "@/lib/schemas/note-fields";
import { UserNoteData, UserNoteId } from "@/lib/schemas/user-note";
import * as UserNotes from "@/server/services/user-notes";

import { authenticatedProcedure, createTrpcRouter } from "../init";

/**
 * The calling user's personal notes. There's no permission beyond ownership: every query and
 * write is scoped to `ctx.userId`, so another user's note is `NOT_FOUND`, never `FORBIDDEN`.
 */
export const userNotesRouter = createTrpcRouter({
    createNote: authenticatedProcedure
        .input(UserNoteData.createSchema)
        .output(z.object({ created: UserNoteData.schema }))
        .mutation(async ({ ctx, input: { title, content } }) => {
            const created = await UserNotes.create(ctx, { title, content });

            return { created };
        }),

    /**
     * Permanently delete one of the caller's notes.
     * @throws TRPCError(NOT_FOUND) if the caller has no such note.
     */
    deleteNote: authenticatedProcedure
        .input(z.object({ noteId: UserNoteId.schema }))
        .output(z.object({ deleted: UserNoteData.schema }))
        .mutation(async ({ ctx, input: { noteId } }) => {
            const note = await UserNotes.requireById(ctx, noteId);

            const deleted = await UserNotes.remove(ctx, note);

            return { deleted };
        }),

    /**
     * @throws TRPCError(NOT_FOUND) if the caller has no such note.
     */
    getNote: authenticatedProcedure
        .input(z.object({ noteId: UserNoteId.schema }))
        .output(UserNoteData.schema)
        .query(async ({ ctx, input: { noteId } }) => {
            return await UserNotes.requireById(ctx, noteId);
        }),

    listNotes: authenticatedProcedure
        .output(z.array(UserNoteData.listItemSchema))
        .query(async ({ ctx }) => {
            return await UserNotes.list(ctx);
        }),

    /**
     * Update the title and/or body of one of the caller's notes.
     * @throws TRPCError(NOT_FOUND) if the caller has no such note.
     */
    updateNote: authenticatedProcedure
        .input(NoteUpdateInput.refine(NoteUpdateInput.schema.extend({ noteId: UserNoteId.schema })))
        .output(z.object({ updated: UserNoteData.schema }))
        .mutation(async ({ ctx, input: { noteId, title, content } }) => {
            const note = await UserNotes.requireById(ctx, noteId);

            const updated = await UserNotes.update(ctx, note, { title, content });

            return { updated };
        }),
});
