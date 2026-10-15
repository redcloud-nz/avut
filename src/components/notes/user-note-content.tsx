/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import Link from "next/link";
import { parseAsBoolean, parseAsStringLiteral, useQueryState } from "nuqs";
import { toast } from "sonner";

import { useMutation, useSuspenseQuery } from "@tanstack/react-query";

import { sessionQueryOptions } from "@/client/auth-queries";
import { userNotesEffects } from "@/client/user-notes-effects";
import { ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EntityActionMenu } from "@/components/ui/menu-action";
import { route } from "@/lib/routes";
import { UserNoteData, UserNoteId } from "@/lib/schemas/user-note";
import { trpc } from "@/trpc/client";

import { UserNotes_DeleteNote_Dialog } from "./delete-user-note-dialog";
import { NoteDetail } from "./note-detail";
import { NoteEditor } from "./note-editor";
import { isNoteNotFound, NoteGoneBoundary } from "./note-gone-boundary";

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
        <NoteGoneBoundary scopeId={session.user.id} noteId={noteId}>
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
                <UserNote_Editor note={note} onDone={closeEditor} />
            ) : (
                <NoteDetail
                    note={note}
                    actions={
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Edit note"
                                onClick={openEditor}
                            >
                                <ObjectIcons.Edit />
                            </Button>
                            <EntityActionMenu
                                category="Notes"
                                width="w-44"
                                before={
                                    <>
                                        <DropdownMenuGroup>
                                            <DropdownMenuItem asChild>
                                                <Link
                                                    href={route("/user/notes/[note_id]/history", {
                                                        note_id: note.id,
                                                    })}
                                                >
                                                    <ObjectIcons.History /> History
                                                </Link>
                                            </DropdownMenuItem>
                                        </DropdownMenuGroup>
                                        <DropdownMenuSeparator />
                                    </>
                                }
                                actions={[
                                    {
                                        verb: "update",
                                        label: "Edit",
                                        icon: <ObjectIcons.Edit />,
                                        onSelect: openEditor,
                                    },
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
function UserNote_Editor({ note, onDone }: { note: UserNoteData; onDone: () => void }) {
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
            status={mutation.status}
            onCancel={onDone}
            onSave={(changes) => mutation.mutate({ noteId: note.id, ...changes })}
        />
    );
}
