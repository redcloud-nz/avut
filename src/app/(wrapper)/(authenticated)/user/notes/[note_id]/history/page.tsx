/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user/notes/[note_id]/history
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { UserNoteHistory_Content } from "@/components/notes/user-note-history-content";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { UserNoteId } from "@/lib/schemas/user-note";
import { resolveUserModuleFlags } from "@/server/module-flags";
import { requireSession } from "@/server/session";
import { fetchQuery, HydrateClient, prefetch, prefetchInfinite, trpc } from "@/trpc/server";

type Props = PageProps<"/user/notes/[note_id]/history">;

/**
 * Parse the note id, after checking personal notes are available, as in `[note_id]/page.tsx`:
 * the layout's `notFound()` doesn't stop this page rendering alongside it, so the check is
 * repeated here to keep the note and its history out of a page that's about to 404.
 */
async function resolveNoteId(props: Props): Promise<UserNoteId> {
    const { note_id } = await props.params;

    await requireSession();
    const userModuleFlags = await resolveUserModuleFlags();
    if (!userModuleFlags["user-notes"]) notFound();

    return UserNoteId.schema.parse(note_id);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const noteId = await resolveNoteId(props);
    const note = await fetchQuery(trpc.userNotes.getNote.queryOptions({ noteId }));

    return {
        title: `${note.title} History ${TITLE_SEPARATOR} Notes`,
    };
}

export default async function UserNotes_NoteHistory_Page(props: Props) {
    const noteId = await resolveNoteId(props);

    prefetch(trpc.userNotes.getNote.queryOptions({ noteId }));
    // Same input as `ObjectHistory`'s client query (no `limit`), so the keys match.
    prefetchInfinite(
        trpc.history.listOwnObjectHistory.infiniteQueryOptions(
            { objectType: "UserNote", objectId: noteId },
            { getNextPageParam: (page) => page.nextCursor ?? undefined },
        ),
    );

    return (
        <HydrateClient>
            <UserNoteHistory_Content noteId={noteId} />
        </HydrateClient>
    );
}
