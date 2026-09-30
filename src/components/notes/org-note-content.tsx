/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { parseAsBoolean, parseAsStringLiteral, useQueryState } from "nuqs";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner";

import { useMutation, useSuspenseQueries } from "@tanstack/react-query";

import { sessionQueryOptions } from "@/client/auth-queries";
import { organizationNotesEffects } from "@/client/organization-notes-effects";
import { Hermes } from "@/components/blocks/hermes";
import { describeError, ErrorDescriptions } from "@/components/errors/describe-error";
import { ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { EntityActionMenu } from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { OrganizationNoteData, OrganizationNoteId } from "@/lib/schemas/organization-note";
import { trpc } from "@/trpc/client";

import { OrgNotes_DeleteNote_Dialog } from "./delete-org-note-dialog";
import { useIsDeletedNote } from "./deleted-notes";
import { NoteDetail } from "./note-detail";
import { NoteEditor } from "./note-editor";

function isNotFound(error: unknown) {
    return describeError(error) === ErrorDescriptions.NotFound;
}

/**
 * The detail pane for one org note: view mode by default, edit mode while `?edit=true`. Switching
 * notes crossfades the pane via `Hermes.Detail`.
 *
 * A note that's gone (deleted here and reached again with Back, or deleted by someone else) says
 * so in the pane rather than falling through to the route's error page. Other errors still
 * propagate.
 */
export function OrgNote_Content({ noteId }: { noteId: OrganizationNoteId }) {
    const organization = useOrganization();
    const deleted = useIsDeletedNote(organization.id, noteId);

    const deletedMessage = (
        <Hermes.Placeholder className="flex">This note was deleted.</Hermes.Placeholder>
    );

    if (deleted) return deletedMessage;

    return (
        <ErrorBoundary
            resetKeys={[noteId]}
            fallbackRender={({ error }) => {
                if (!isNotFound(error)) throw error;
                return deletedMessage;
            }}
        >
            <OrgNote_Body noteId={noteId} />
        </ErrorBoundary>
    );
}

function OrgNote_Body({ noteId }: { noteId: OrganizationNoteId }) {
    const organization = useOrganization();

    // `listNotes` is already loaded by the layout; it's read here only for the author's name,
    // which `getNote` doesn't carry.
    const [{ data: note }, { data: notes }, { data: session }] = useSuspenseQueries({
        queries: [
            trpc.organizationNotes.getNote.queryOptions(
                { organizationId: organization.id, noteId },
                // A missing note won't turn up on a retry, so go straight to "deleted".
                { retry: (count, error) => !isNotFound(error) && count < 3 },
            ),
            trpc.organizationNotes.listNotes.queryOptions({ organizationId: organization.id }),
            sessionQueryOptions(),
        ],
    });
    const author = notes.find((item) => item.id === noteId)?.author;

    // "Author, or holder of the any-note permission" can't be said with `<Protect>`. This mirrors
    // `organizationNotes.updateNote`/`deleteNote`, which are the real guard: both require `create`,
    // then either authorship or `update`/`delete`.
    const isAuthor = note.authorId !== null && note.authorId === session?.user.id;
    const canCreate = useHasPermission({ organizationNote: ["create"] });
    const canUpdateAny = useHasPermission({ organizationNote: ["update"] });
    const canDeleteAny = useHasPermission({ organizationNote: ["delete"] });
    const canEdit = canCreate && (isAuthor || canUpdateAny);
    const canDelete = canCreate && (isAuthor || canDeleteAny);

    const [edit, setEdit] = useQueryState("edit", parseAsBoolean.withDefault(false));
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["delete"] as const));

    const editing = edit && canEdit;
    const byline = note.authorId === null ? "Unknown author" : author?.name;

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
                <OrgNote_Editor note={note} byline={byline} onDone={closeEditor} />
            ) : (
                <NoteDetail
                    note={note}
                    byline={byline}
                    actions={
                        <>
                            {canEdit && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Edit note"
                                    onClick={openEditor}
                                >
                                    <ObjectIcons.Edit />
                                </Button>
                            )}
                            <EntityActionMenu
                                category="Notes"
                                width="w-44"
                                actions={[
                                    {
                                        verb: "update",
                                        label: "Edit",
                                        icon: <ObjectIcons.Edit />,
                                        onSelect: openEditor,
                                        disabled: !canEdit,
                                    },
                                    {
                                        verb: "delete",
                                        label: "Delete",
                                        icon: <ObjectIcons.Delete />,
                                        onSelect: () => handleDeleteOpenChange(true),
                                        disabled: !canDelete,
                                        destructive: true,
                                    },
                                ]}
                            />
                        </>
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
function OrgNote_Editor({
    note,
    byline,
    onDone,
}: {
    note: OrganizationNoteData;
    byline: string | undefined;
    onDone: () => void;
}) {
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
            byline={byline}
            status={mutation.status}
            onCancel={onDone}
            onSave={(changes) =>
                mutation.mutate({ organizationId: organization.id, noteId: note.id, ...changes })
            }
        />
    );
}
