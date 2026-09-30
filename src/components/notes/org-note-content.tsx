/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsBoolean, parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { sessionQueryOptions } from "@/client/auth-queries";
import { organizationNotesEffects } from "@/client/organization-notes-effects";
import { ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { OrganizationNoteData, OrganizationNoteId } from "@/lib/schemas/organization-note";
import { trpc } from "@/trpc/client";

import { OrgNotes_DeleteNote_Dialog } from "./delete-org-note-dialog";
import { NoteDetail } from "./note-detail";
import { NoteEditor } from "./note-editor";

/**
 * The detail pane for one org note: view mode by default, edit mode while `?edit=true`. Switching
 * notes crossfades the pane via `Hermes.Detail`.
 */
export function OrgNote_Content({ noteId }: { noteId: OrganizationNoteId }) {
    const organization = useOrganization();

    // `listNotes` is already loaded by the layout; it's read here only for the author's name,
    // which `getNote` doesn't carry.
    const [{ data: note }, { data: notes }, { data: session }] = useSuspenseQueries({
        queries: [
            trpc.organizationNotes.getNote.queryOptions({
                organizationId: organization.id,
                noteId,
            }),
            trpc.organizationNotes.listNotes.queryOptions({ organizationId: organization.id }),
            sessionQueryOptions(),
        ],
    });
    const author = notes.find((item) => item.id === noteId)?.author;

    // "Author, or holder of the any-note permission" can't be said with `<Protect>`. This mirrors
    // the check in `organizationNotes.updateNote`/`deleteNote`, which are the real guard.
    const isAuthor = note.authorId !== null && note.authorId === session?.user.id;
    const canUpdateAny = useHasPermission({ organizationNote: ["update"] });
    const canDeleteAny = useHasPermission({ organizationNote: ["delete"] });
    const canEdit = isAuthor || canUpdateAny;
    const canDelete = isAuthor || canDeleteAny;

    const [edit, setEdit] = useQueryState("edit", parseAsBoolean.withDefault(false));
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["delete"] as const));

    const editing = edit && canEdit;

    function openEditor() {
        void setEdit(true, { history: "push" });
    }

    function closeEditor() {
        void setEdit(null, { history: "replace" });
    }

    function handleDeleteOpenChange(open: boolean) {
        void setAction(open ? "delete" : null, { history: open ? "push" : "replace" });
    }

    return (
        <>
            {editing ? (
                <OrgNote_Editor note={note} onDone={closeEditor} />
            ) : (
                <NoteDetail
                    note={note}
                    byline={note.authorId === null ? "Unknown author" : author?.name}
                    actions={
                        (canEdit || canDelete) && (
                            <>
                                {canEdit && (
                                    <Button variant="outline" size="sm" onClick={openEditor}>
                                        <ObjectIcons.Edit />
                                        Edit
                                    </Button>
                                )}
                                {canDelete && (
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Delete note"
                                        onClick={() => handleDeleteOpenChange(true)}
                                    >
                                        <ObjectIcons.Delete />
                                    </Button>
                                )}
                            </>
                        )
                    }
                />
            )}
            {canDelete && (
                <OrgNotes_DeleteNote_Dialog
                    note={note}
                    open={action === "delete"}
                    onOpenChange={handleDeleteOpenChange}
                />
            )}
        </>
    );
}

/**
 * Edit mode. Owns the update mutation, so both it and the draft start fresh each time the editor
 * opens.
 */
function OrgNote_Editor({ note, onDone }: { note: OrganizationNoteData; onDone: () => void }) {
    const organization = useOrganization();

    const mutation = useMutation(
        trpc.organizationNotes.updateNote.mutationOptions({
            meta: { effects: organizationNotesEffects.updateNote },
            onError(error) {
                console.error("Failed to save note:", error);
                toast.error(`Failed to save note: ${error.message}`);
            },
            onSuccess() {
                onDone();
            },
        }),
    );

    return (
        <NoteEditor
            note={note}
            status={mutation.status}
            onCancel={onDone}
            onSave={(changes) =>
                mutation.mutate({ organizationId: organization.id, noteId: note.id, ...changes })
            }
        />
    );
}
