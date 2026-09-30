/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { NoteUpdateInput } from "@/lib/schemas/note-fields";
import { OrganizationNoteData, OrganizationNoteId } from "@/lib/schemas/organization-note";
import * as OrganizationNotes from "@/server/services/organization-notes";

import { createTrpcRouter, organizationProcedure } from "../init";

/**
 * Organization notes. Anyone who can `create` a note can edit or delete their own; editing or
 * deleting someone else's note (or an authorless one) takes `organizationNote: ["update"]` or
 * `["delete"]`, checked in the procedure once the note is loaded.
 */
export const organizationNotesRouter = createTrpcRouter({
    createNote: organizationProcedure({ organizationNote: ["create"] })
        .input(OrganizationNoteData.createSchema)
        .output(z.object({ created: OrganizationNoteData.schema }))
        .mutation(async ({ ctx, input: { title, content } }) => {
            const created = await OrganizationNotes.create(ctx, { title, content });

            return { created };
        }),

    /**
     * Permanently delete a note.
     * @throws TRPCError(NOT_FOUND) if the note is not in the organization.
     * @throws TRPCError(FORBIDDEN) if the caller isn't the author and lacks `organizationNote: ["delete"]`.
     */
    deleteNote: organizationProcedure({ organizationNote: ["create"] })
        .input(z.object({ noteId: OrganizationNoteId.schema }))
        .output(z.object({ deleted: OrganizationNoteData.schema }))
        .mutation(async ({ ctx, input: { noteId } }) => {
            const note = await OrganizationNotes.requireById(ctx, noteId);

            if (note.authorId !== ctx.userId) {
                await ctx.hasPermission(ctx.organizationId, { organizationNote: ["delete"] });
            }

            const deleted = await OrganizationNotes.remove(ctx, note);

            return { deleted };
        }),

    /**
     * @throws TRPCError(NOT_FOUND) if the note is not in the organization.
     */
    getNote: organizationProcedure({ organizationNote: ["view"] })
        .input(z.object({ noteId: OrganizationNoteId.schema }))
        .output(OrganizationNoteData.schema)
        .query(async ({ ctx, input: { noteId } }) => {
            return await OrganizationNotes.requireById(ctx, noteId);
        }),

    listNotes: organizationProcedure({ organizationNote: ["view"] })
        .output(z.array(OrganizationNoteData.listItemSchema))
        .query(async ({ ctx }) => {
            return await OrganizationNotes.list(ctx);
        }),

    /**
     * Update a note's title and/or body.
     * @throws TRPCError(NOT_FOUND) if the note is not in the organization.
     * @throws TRPCError(FORBIDDEN) if the caller isn't the author and lacks `organizationNote: ["update"]`.
     */
    updateNote: organizationProcedure({ organizationNote: ["create"] })
        .input(
            NoteUpdateInput.refine(
                NoteUpdateInput.schema.extend({ noteId: OrganizationNoteId.schema }),
            ),
        )
        .output(z.object({ updated: OrganizationNoteData.schema }))
        .mutation(async ({ ctx, input: { noteId, title, content } }) => {
            const note = await OrganizationNotes.requireById(ctx, noteId);

            if (note.authorId !== ctx.userId) {
                await ctx.hasPermission(ctx.organizationId, { organizationNote: ["update"] });
            }

            const updated = await OrganizationNotes.update(ctx, note, { title, content });

            return { updated };
        }),
});
