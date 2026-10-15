/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { ReactNode } from "react";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { userNotesEffects } from "@/client/user-notes-effects";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

import { NotesBreadcrumbs } from "./notes-breadcrumbs";
import { NotesList } from "./notes-list";

function useUserNotes() {
    const { data: notes } = useSuspenseQuery(trpc.userNotes.listNotes.queryOptions());

    return notes;
}

function noteHref(noteId: string) {
    return route("/user/notes/[note_id]", { note_id: noteId });
}

/**
 * The personal notes list pane. Rendered from the notes `layout.tsx`, so it stays mounted (with
 * its sort and scroll position) while the detail pane changes. Every user can create notes, so
 * New note is always shown.
 */
export function UserNotes_List() {
    const notes = useUserNotes();
    const router = useRouter();
    const selectedId = useSelectedLayoutSegment();

    // No `meta.navigates`: `listNotes` stays mounted in the layout, so the create must wait for it
    // to refetch, or the new note would be missing from the list it opens beside.
    const createMutation = useMutation(
        trpc.userNotes.createNote.mutationOptions({
            meta: { effects: userNotesEffects.createNote },
            onSuccess({ created }) {
                router.push(`${noteHref(created.id)}?edit=true`);
            },
        }),
    );

    return (
        <NotesList
            notes={notes}
            selectedId={selectedId}
            hrefFor={noteHref}
            onCreate={() => createMutation.mutate({ title: "Untitled note" })}
            creating={createMutation.isPending}
        />
    );
}

/** The navbar for the personal notes layout; names the selected note from the list query. */
export function UserNotes_Breadcrumbs({ actions }: { actions?: ReactNode }) {
    const notes = useUserNotes();

    return (
        <NotesBreadcrumbs
            notes={notes}
            listHref="/user/notes"
            noteHref={noteHref}
            actions={actions}
        />
    );
}
