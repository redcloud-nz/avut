/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsBoolean, parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { sessionQueryOptions } from "@/client/auth-queries";
import { userNotesEffects } from "@/client/user-notes-effects";
import type { SaratogaBreadcrumb } from "@/components/blocks/saratoga";
import { ObjectIcons } from "@/components/icons";
import { NoteDetail } from "@/components/notes/note-detail";
import { NoteEditor } from "@/components/notes/note-editor";
import { isNoteNotFound, NoteGoneBoundary } from "@/components/notes/note-gone-boundary";
import { notesBreadcrumbs } from "@/components/notes/notes-breadcrumbs";
import { RecordCardEditButton, RecordCardMenu } from "@/components/ui/record-card-actions";
import { route } from "@/lib/routes";
import { UserNoteData, UserNoteId } from "@/lib/schemas/user-note";
import { trpc } from "@/trpc/client";

import { UserNotes_DeleteNote_Dialog } from "./delete-user-note-dialog";

/**
 * The detail pane for one personal note: view mode by default, edit mode while `?edit=true`.
 * Switching notes crossfades the pane via `Hermes.Detail`. A note that's gone says so in the pane
 * (see `NoteGoneBoundary`).
 */
export function UserNote_Content({ noteId }: { noteId: UserNoteId }) {
    // The session is loaded by the authenticated layout, so this doesn't suspend.
    const { data: session } = useSuspenseQuery(sessionQueryOptions());
    if (!session) throw new Error("Personal notes need a signed-in user.");

    return (
        <NoteGoneBoundary scopeId={session.user.id} noteId={noteId} listHref="/user/notes">
            <UserNote_Body noteId={noteId} />
        </NoteGoneBoundary>
    );
}

function UserNote_Body({ noteId }: { noteId: UserNoteId }) {
    const { data: note } = useSuspenseQuery(
        trpc.userNotes.getNote.queryOptions(
            { noteId },
            // A missing note won't turn up on a retry, so go straight to "deleted".
            { retry: (count, error) => !isNoteNotFound(error) && count < 3 },
        ),
    );

    // A personal note is only ever the caller's own (`userNotes` scopes every query to them), so
    // Edit and Delete are always available.
    const [edit, setEdit] = useQueryState("edit", parseAsBoolean.withDefault(false));
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["delete"] as const));

    const breadcrumbs = notesBreadcrumbs("/user/notes");

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
            {edit ? (
                <UserNote_Editor note={note} breadcrumbs={breadcrumbs} onDone={closeEditor} />
            ) : (
                <NoteDetail
                    note={note}
                    breadcrumbs={breadcrumbs}
                    historyHref={route("/user/notes/[note_id]/history", { note_id: note.id })}
                    actions={
                        <>
                            {/* View mode only, so ⌥E can't fire while the editor is open. */}
                            <RecordCardEditButton
                                label="Edit note"
                                category="Notes"
                                primary
                                onClick={openEditor}
                            />
                            <RecordCardMenu
                                category="Notes"
                                primary
                                actions={[
                                    {
                                        verb: "delete",
                                        label: "Delete",
                                        icon: <ObjectIcons.Delete />,
                                        onSelect: () => handleDeleteOpenChange(true),
                                        destructive: true,
                                    },
                                ]}
                            />
                        </>
                    }
                />
            )}
            <UserNotes_DeleteNote_Dialog
                note={note}
                open={action === "delete"}
                onOpenChange={handleDeleteOpenChange}
            />
        </>
    );
}

/**
 * Edit mode. Owns the update mutation, so both it and the draft start fresh each time the editor
 * opens.
 */
function UserNote_Editor({
    note,
    breadcrumbs,
    onDone,
}: {
    note: UserNoteData;
    breadcrumbs: SaratogaBreadcrumb[];
    onDone: () => void;
}) {
    const mutation = useMutation(
        trpc.userNotes.updateNote.mutationOptions({
            meta: { effects: userNotesEffects.updateNote },
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
            breadcrumbs={breadcrumbs}
            status={mutation.status}
            onCancel={onDone}
            onSave={(changes) => mutation.mutate({ noteId: note.id, ...changes })}
        />
    );
}
