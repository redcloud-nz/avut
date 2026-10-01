/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate, write } from "@/trpc/mutation-effector";

/**
 * Cache effects for `organizationNotes` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 *
 * `listNotes` is read by the notes layout, which stays mounted across record navigation, so a
 * navigating mutation (`meta.navigates`) only marks it stale and it won't refetch on arrival.
 * `deleteNote` therefore also drops the note from the cached list by hand, and `createNote` is
 * called without `meta.navigates`, so the new note is in the list before the push to it.
 */
export const organizationNotesEffects = createEffects<"organizationNotes">()({
    createNote: (vars, { created }) => [
        write(
            trpc.organizationNotes.getNote.queryKey({
                organizationId: vars.organizationId,
                noteId: created.id,
            }),
            created,
        ),
        invalidate(
            trpc.organizationNotes.listNotes.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
    deleteNote: (vars) => [
        write(
            trpc.organizationNotes.listNotes.queryKey({ organizationId: vars.organizationId }),
            (notes) => notes?.filter((note) => note.id !== vars.noteId),
        ),
        invalidate(
            trpc.organizationNotes.listNotes.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
    updateNote: (vars, { updated }) => [
        write(
            trpc.organizationNotes.getNote.queryKey({
                organizationId: vars.organizationId,
                noteId: vars.noteId,
            }),
            updated,
        ),
        invalidate(
            trpc.organizationNotes.listNotes.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
});
