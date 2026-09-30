/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { ComponentProps } from "react";
import { toast } from "sonner";

import { useMutation } from "@tanstack/react-query";

import { organizationNotesEffects } from "@/client/organization-notes-effects";
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
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { OrganizationNoteData } from "@/lib/schemas/organization-note";
import { trpc } from "@/trpc/client";

/**
 * Confirms and permanently deletes an org note, then returns to the notes list. Host-driven: the
 * note's detail pane owns the `?action=delete` param and passes `open`/`onOpenChange`.
 */
export function OrgNotes_DeleteNote_Dialog({
    note,
    ...props
}: ComponentProps<typeof AlertDialog> & { note: OrganizationNoteData }) {
    const organization = useOrganization();
    const router = useRouter();

    const mutation = useMutation(
        trpc.organizationNotes.deleteNote.mutationOptions({
            meta: { effects: organizationNotesEffects.deleteNote, navigates: true },
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
                router.replace(route("/orgs/[slug]/notes", { slug: organization.slug }));
            },
        }),
    );

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
                        onClick={() =>
                            mutation.mutate({ organizationId: organization.id, noteId: note.id })
                        }
                    />
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
