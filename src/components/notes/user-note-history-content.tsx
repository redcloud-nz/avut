/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { sessionQueryOptions } from "@/client/auth-queries";
import { ObjectHistory } from "@/components/history/object-history";
import { UserNoteId } from "@/lib/schemas/user-note";
import { trpc } from "@/trpc/client";

import { isNoteNotFound, NoteGoneBoundary } from "./note-gone-boundary";

/**
 * A personal note's History, in the notes detail pane, read from the caller's own log. The notes
 * layout supplies the navbar (whose breadcrumbs lead back to the note), and the pane scrolls, so
 * this renders only the history. A note that's gone says so instead, as on the note itself (see
 * `NoteGoneBoundary`).
 */
export function UserNoteHistory_Content({ noteId }: { noteId: UserNoteId }) {
    // The session is loaded by the authenticated layout, so this doesn't suspend.
    const { data: session } = useSuspenseQuery(sessionQueryOptions());
    if (!session) throw new Error("Personal notes need a signed-in user.");

    return (
        <NoteGoneBoundary scopeId={session.user.id} noteId={noteId}>
            <UserNoteHistory_Body noteId={noteId} />
        </NoteGoneBoundary>
    );
}

function UserNoteHistory_Body({ noteId }: { noteId: UserNoteId }) {
    const { data: note } = useSuspenseQuery(
        trpc.userNotes.getNote.queryOptions(
            { noteId },
            // A missing note won't turn up on a retry, so go straight to "deleted".
            { retry: (count, error) => !isNoteNotFound(error) && count < 3 },
        ),
    );

    return (
        <ObjectHistory
            scope="user"
            objectType="UserNote"
            objectId={noteId}
            title={`${note.title} — History`}
        />
    );
}
