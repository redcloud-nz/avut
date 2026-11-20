/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { ObjectHistory } from "@/components/history/object-history";
import { isNoteNotFound, NoteGoneBoundary } from "@/components/notes/note-gone-boundary";
import { notesBreadcrumbs } from "@/components/notes/notes-breadcrumbs";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { OrganizationNoteId } from "@/lib/schemas/organization-note";
import { trpc } from "@/trpc/client";

/**
 * An org note's History, in the notes detail pane, with a trail leading back to the note. The pane
 * scrolls, so this renders only the history. A note that's gone says so instead, as on the note
 * itself (see `NoteGoneBoundary`).
 */
export function OrgNoteHistory_Content({ noteId }: { noteId: OrganizationNoteId }) {
    const organization = useOrganization();

    return (
        <NoteGoneBoundary scopeId={organization.id} noteId={noteId}>
            <OrgNoteHistory_Body noteId={noteId} />
        </NoteGoneBoundary>
    );
}

function OrgNoteHistory_Body({ noteId }: { noteId: OrganizationNoteId }) {
    const organization = useOrganization();

    const { data: note } = useSuspenseQuery(
        trpc.organizationNotes.getNote.queryOptions(
            { organizationId: organization.id, noteId },
            // A missing note won't turn up on a retry, so go straight to "deleted".
            { retry: (count, error) => !isNoteNotFound(error) && count < 3 },
        ),
    );

    return (
        <ObjectHistory
            objectType="OrganizationNote"
            objectId={noteId}
            title={`${note.title} — History`}
            breadcrumbs={notesBreadcrumbs(
                route("/orgs/[slug]/notes", { slug: organization.slug }),
                {
                    title: note.title,
                    href: route("/orgs/[slug]/notes/[note_id]", {
                        slug: organization.slug,
                        note_id: noteId,
                    }),
                },
            )}
        />
    );
}
