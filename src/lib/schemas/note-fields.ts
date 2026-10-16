/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

/** A note's title, shared by organization and user notes: required, trimmed, 1–200 chars. */
export const NoteTitle = {
    schema: z.string().trim().min(1, "Title is required").max(200),
} as const;

/** A note's markdown body. The cap is only a sanity limit, not a design constraint. */
export const NoteContent = {
    schema: z.string().max(100_000),
} as const;

/** Input for creating a note, organization or user: a title, and optionally its markdown body. */
export const NoteCreateInput = {
    schema: z.object({
        title: NoteTitle.schema,
        content: NoteContent.schema.optional(),
    }),
} as const;

/**
 * Input for updating a note, organization or user: a title and/or a body.
 *
 * `schema` is deliberately unrefined, so it can still be `.extend`ed (Zod 4 throws on
 * `.pick`/`.omit`/`.extend` of a refined object). Apply the "at least one of them" rule
 * to the finished input with {@link NoteUpdateInput.refine}:
 *
 * ```ts
 * NoteUpdateInput.refine(NoteUpdateInput.schema.extend({ noteId: OrganizationNoteId.schema }))
 * ```
 */
export const NoteUpdateInput = {
    schema: z.object({
        title: NoteTitle.schema.optional(),
        content: NoteContent.schema.optional(),
    }),

    /** Rejects an update that sets neither the title nor the body. */
    refine: <T extends z.ZodType<{ title?: string; content?: string }>>(schema: T) =>
        schema.refine(
            (update) => update.title !== undefined || update.content !== undefined,
            "Nothing to update.",
        ),
} as const;
