/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/notes/[note_id]
 */

import { Metadata } from "next";

import { OrgNote_Content } from "@/components/notes/org-note-content";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { OrganizationNoteId } from "@/lib/schemas/organization-note";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/notes/[note_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, note_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const noteId = OrganizationNoteId.schema.parse(note_id);
    const note = await fetchQuery(
        trpc.organizationNotes.getNote.queryOptions({ organizationId: organization.id, noteId }),
    );

    return {
        title: `${note.title} ${TITLE_SEPARATOR} Notes`,
    };
}

export default async function Notes_Note_Page(props: Props) {
    const { slug, note_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const noteId = OrganizationNoteId.schema.parse(note_id);

    prefetch(
        trpc.organizationNotes.getNote.queryOptions({ organizationId: organization.id, noteId }),
    );

    return (
        <HydrateClient>
            <OrgNote_Content noteId={noteId} />
        </HydrateClient>
    );
}
