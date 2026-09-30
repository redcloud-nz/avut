/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/notes/[note_id]
 */

import { Metadata } from "next";

import { OrgNote_Content } from "@/components/notes/org-note-content";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { isModuleUsable } from "@/lib/module-flags";
import { OrganizationNoteId } from "@/lib/schemas/organization-note";
import { resolveModuleFlags } from "@/server/module-flags";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/notes/[note_id]">;

/**
 * The org, and whether it can use the Notes module. As in the notes layout, the note is only
 * fetched when it can, so an org with the module off gets neither the title nor the note in the
 * page; `Notes_ModuleGate` in the layout renders the "not enabled" error. Both calls are cached per
 * request, and run in sequence for the reason given in the layout.
 */
async function resolveNotesOrganization(slug: string) {
    const { organization, settings } = await requireOrganization(slug);
    const moduleFlags = await resolveModuleFlags();

    return {
        organization,
        usable: isModuleUsable(moduleFlags, "notes", settings.modules.notes.enabled),
    };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, note_id } = await props.params;
    const { organization, usable } = await resolveNotesOrganization(slug);

    if (!usable) return { title: "Notes" };

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
    const { organization, usable } = await resolveNotesOrganization(slug);

    const noteId = OrganizationNoteId.schema.parse(note_id);

    if (usable) {
        prefetch(
            trpc.organizationNotes.getNote.queryOptions({
                organizationId: organization.id,
                noteId,
            }),
        );
    }

    return (
        <HydrateClient>
            <OrgNote_Content noteId={noteId} />
        </HydrateClient>
    );
}
