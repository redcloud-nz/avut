/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { ReactNode } from "react";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { organizationNotesEffects } from "@/client/organization-notes-effects";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { trpc } from "@/trpc/client";

import { NotesBreadcrumbs } from "./notes-breadcrumbs";
import { NotesList } from "./notes-list";

function useOrgNotes() {
    const organization = useOrganization();

    const { data: notes } = useSuspenseQuery(
        trpc.organizationNotes.listNotes.queryOptions({ organizationId: organization.id }),
    );

    return { organization, notes };
}

/**
 * The org notes list pane. Rendered from the notes `layout.tsx`, so it stays mounted (with its
 * sort and scroll position) while the detail pane changes.
 */
export function OrgNotes_List() {
    const { organization, notes } = useOrgNotes();
    const router = useRouter();
    const selectedId = useSelectedLayoutSegment();
    const canCreate = useHasPermission({ organizationNote: ["create"] });

    // No `meta.navigates`: `listNotes` stays mounted in the layout, so the create must wait for it
    // to refetch, or the new note would be missing from the list it opens beside.
    const createMutation = useMutation(
        trpc.organizationNotes.createNote.mutationOptions({
            meta: { effects: organizationNotesEffects.createNote },
            onSuccess({ created }) {
                router.push(
                    `${route("/orgs/[slug]/notes/[note_id]", { slug: organization.slug, note_id: created.id })}?edit=true`,
                );
            },
        }),
    );

    return (
        <NotesList
            notes={notes}
            selectedId={selectedId}
            hrefFor={(noteId) =>
                route("/orgs/[slug]/notes/[note_id]", { slug: organization.slug, note_id: noteId })
            }
            onCreate={
                canCreate
                    ? () =>
                          createMutation.mutate({
                              organizationId: organization.id,
                              title: "Untitled note",
                          })
                    : undefined
            }
            creating={createMutation.isPending}
        />
    );
}

/** The navbar for the org notes layout; names the selected note from the list query. */
export function OrgNotes_Breadcrumbs({ actions }: { actions?: ReactNode }) {
    const { organization, notes } = useOrgNotes();

    return (
        <NotesBreadcrumbs
            notes={notes}
            listHref={route("/orgs/[slug]/notes", { slug: organization.slug })}
            noteHref={(noteId) =>
                route("/orgs/[slug]/notes/[note_id]", { slug: organization.slug, note_id: noteId })
            }
            actions={actions}
        />
    );
}
