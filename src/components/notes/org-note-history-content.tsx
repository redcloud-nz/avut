/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { ObjectHistory } from "@/components/history/object-history";
import { useOrganization } from "@/hooks/use-organization";
import { OrganizationNoteId } from "@/lib/schemas/organization-note";
import { trpc } from "@/trpc/client";

/**
 * An org note's History, in the notes detail pane. The notes layout supplies the navbar (whose
 * breadcrumbs lead back to the note), and the pane scrolls, so this renders only the history.
 */
export function OrgNoteHistory_Content({ noteId }: { noteId: OrganizationNoteId }) {
    const organization = useOrganization();

    const { data: note } = useSuspenseQuery(
        trpc.organizationNotes.getNote.queryOptions({ organizationId: organization.id, noteId }),
    );

    return (
        <ObjectHistory
            objectType="OrganizationNote"
            objectId={noteId}
            title={`${note.title} — History`}
        />
    );
}
