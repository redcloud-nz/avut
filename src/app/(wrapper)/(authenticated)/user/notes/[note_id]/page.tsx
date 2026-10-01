/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /user/notes/[note_id]
 */

import { Metadata } from "next";
import { notFound } from "next/navigation";

import { UserNote_Content } from "@/components/notes/user-note-content";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { UserNoteId } from "@/lib/schemas/user-note";
import { resolveUserModuleFlags } from "@/server/module-flags";
import { requireSession } from "@/server/session";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/user/notes/[note_id]">;

/**
 * Parse the note id, after checking personal notes are available. The notes layout also calls
 * `notFound()` when they aren't, but a page renders alongside its layout, so the check is repeated
 * here to keep the note out of a page that's about to 404. Both calls are cached per request, and
 * run in sequence for the reason given in the layout.
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
        title: `${note.title} ${TITLE_SEPARATOR} Notes`,
    };
}

export default async function UserNotes_Note_Page(props: Props) {
    const noteId = await resolveNoteId(props);

    prefetch(trpc.userNotes.getNote.queryOptions({ noteId }));

    return (
        <HydrateClient>
            <UserNote_Content noteId={noteId} />
        </HydrateClient>
    );
}
