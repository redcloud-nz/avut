/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate, write } from "@/trpc/mutation-effector";

/**
 * Cache effects for `userNotes` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 *
 * As with `organizationNotesEffects`: `listNotes` is read by the notes layout, which stays mounted
 * across record navigation, so a navigating mutation (`meta.navigates`) only marks it stale and it
 * won't refetch on arrival. `deleteNote` therefore also drops the note from the cached list by
 * hand, and `createNote` is called without `meta.navigates`, so the new note is in the list before
 * the push to it.
 */
export const userNotesEffects = createEffects<"userNotes">()({
    createNote: (_vars, { created }) => [
        write(trpc.userNotes.getNote.queryKey({ noteId: created.id }), created),
        invalidate(trpc.userNotes.listNotes.queryFilter()),
    ],
    deleteNote: (vars) => [
        write(trpc.userNotes.listNotes.queryKey(), (notes) =>
            notes?.filter((note) => note.id !== vars.noteId),
        ),
        invalidate(trpc.userNotes.listNotes.queryFilter()),
    ],
    updateNote: (vars, { updated }) => [
        write(trpc.userNotes.getNote.queryKey({ noteId: vars.noteId }), updated),
        invalidate(trpc.userNotes.listNotes.queryFilter()),
    ],
});
