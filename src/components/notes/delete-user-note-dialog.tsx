/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { ComponentProps, useEffect } from "react";
import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { userNotesEffects } from "@/client/user-notes-effects";
import {
    AlertDialog,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MutationButton } from "@/components/ui/button";
import { ObjectName } from "@/components/ui/typography";
import { UserNoteData } from "@/lib/schemas/user-note";
import { trpc } from "@/trpc/client";

import { rememberDeletedNote } from "./deleted-notes";

/**
 * Confirms and permanently deletes a personal note, then returns to the notes list. Host-driven:
 * the note's detail pane owns the `?action=delete` param and passes `open`/`onOpenChange`.
 */
export function UserNotes_DeleteNote_Dialog({
    note,
    ...props
}: ComponentProps<typeof AlertDialog> & { note: UserNoteData }) {
    const router = useRouter();
    const queryClient = useQueryClient();

    const mutation = useMutation(
        trpc.userNotes.deleteNote.mutationOptions({
            meta: { effects: userNotesEffects.deleteNote, navigates: true },
            onError(error) {
                console.error("Failed to delete note:", error);
                toast.error(`Failed to delete note: ${error.message}`);
            },
            onSuccess() {
                toast.success(
                    <>
                        Note <ObjectName>{note.title}</ObjectName> deleted.
                    </>,
                );

                // The navigation is the whole close: don't also clear `?action=` or reset the
                // mutation, since a competing URL write races the replace.
                router.replace("/user/notes");
            },
        }),
    );

    // Once the delete has succeeded, and as this dialog unmounts (i.e. once the replace to the list
    // has landed; any sooner and the still-open detail would react), record the note as deleted
    // and drop its cached `getNote`. Back to the note's URL then says it was deleted, rather than
    // showing it from the cache with Edit and Delete. See `deleted-notes.ts` for why both.
    useEffect(() => {
        if (!mutation.isSuccess) return;

        return () => {
            rememberDeletedNote(queryClient, note.userId, note.id);
            queryClient.removeQueries({
                queryKey: trpc.userNotes.getNote.queryKey({ noteId: note.id }),
            });
        };
    }, [mutation.isSuccess, queryClient, note.userId, note.id]);

    return (
        <AlertDialog {...props}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete note</AlertDialogTitle>
                    <AlertDialogDescription>
                        Permanently delete <ObjectName>{note.title}</ObjectName>? This can&apos;t be
                        undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <MutationButton
                        type="button"
                        variant="destructive"
                        status={mutation.status}
                        text={{ idle: "Delete", pending: "Deleting", success: "Deleted" }}
                        onClick={() => mutation.mutate({ noteId: note.id })}
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
